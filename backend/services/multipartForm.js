export function createMultipartError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function getContentType(request) {
  const value = request.headers["content-type"] || request.headers["Content-Type"] || "";
  return Array.isArray(value) ? value[0] : value;
}

function parseBoundary(contentType) {
  const match = /multipart\/form-data;\s*boundary=(?:"([^"]+)"|([^;]+))/i.exec(contentType);
  return match ? (match[1] || match[2] || "").trim() : "";
}

function parseHeaders(rawHeaders) {
  const headers = {};
  for (const line of rawHeaders.split("\r\n")) {
    const separatorIndex = line.indexOf(":");
    if (separatorIndex === -1) continue;
    const key = line.slice(0, separatorIndex).trim().toLowerCase();
    const value = line.slice(separatorIndex + 1).trim();
    if (key) headers[key] = value;
  }
  return headers;
}

function parseDisposition(value = "") {
  const name = /(?:^|;\s*)name="([^"]*)"/i.exec(value)?.[1] || "";
  const filename = /(?:^|;\s*)filename="([^"]*)"/i.exec(value)?.[1];
  return { name, filename };
}

function appendField(fields, name, value) {
  if (!fields[name]) fields[name] = [];
  fields[name].push(value);
}

export async function parseMultipartRequest(request, options = {}) {
  const boundary = parseBoundary(getContentType(request));
  if (!boundary) {
    throw createMultipartError(400, "Photo uploads must use multipart form data.");
  }

  const maxBytes = Number(options.maxBytes || 25_000_000);
  const maxFiles = Number(options.maxFiles || 10);
  const chunks = [];
  let totalBytes = 0;

  for await (const chunk of request) {
    totalBytes += chunk.length;
    if (totalBytes > maxBytes) {
      throw createMultipartError(413, "This upload is too large.");
    }
    chunks.push(chunk);
  }

  const body = Buffer.concat(chunks);
  const raw = body.toString("latin1");
  const delimiter = `--${boundary}`;
  const parts = raw.split(delimiter);
  const fields = {};
  const files = [];

  for (const part of parts) {
    if (!part || part === "--\r\n" || part === "--") continue;

    const normalizedPart = part.startsWith("\r\n") ? part.slice(2) : part;
    if (normalizedPart.startsWith("--")) continue;

    const headerEnd = normalizedPart.indexOf("\r\n\r\n");
    if (headerEnd === -1) continue;

    const headers = parseHeaders(normalizedPart.slice(0, headerEnd));
    const disposition = parseDisposition(headers["content-disposition"]);
    if (!disposition.name) continue;

    let content = normalizedPart.slice(headerEnd + 4);
    if (content.endsWith("\r\n")) content = content.slice(0, -2);

    const buffer = Buffer.from(content, "latin1");

    if (disposition.filename !== undefined) {
      if (!disposition.filename) continue;
      if (files.length >= maxFiles) {
        throw createMultipartError(400, `Upload at most ${maxFiles} photos at a time.`);
      }

      files.push({
        fieldName: disposition.name,
        filename: disposition.filename,
        contentType: (headers["content-type"] || "").split(";")[0].trim().toLowerCase(),
        buffer,
        size: buffer.length,
      });
    } else {
      appendField(fields, disposition.name, buffer.toString("utf8"));
    }
  }

  return { fields, files };
}
