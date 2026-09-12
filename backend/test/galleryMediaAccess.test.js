import assert from "node:assert/strict";
import test from "node:test";

process.env.DB_HOST ??= "127.0.0.1";
process.env.DB_USER ??= "test";
process.env.DB_PASSWORD ??= "test";
process.env.DB_NAME ??= "test";

const { galleryMediaUrl, verifyGalleryMediaUrl } = await import("../services/galleryStorage.js");

const signingOptions = {
  nowSeconds: 1_800_000_000,
  ttlSeconds: 600,
  secret: "gallery-media-test-secret",
};

test("Gallery media links are signed, time-limited, and variant-specific", () => {
  const mediaUrl = new URL(
    galleryMediaUrl("mysql-photo-1", "thumbnail", signingOptions),
    "https://api.example.test",
  );
  const access = {
    storageKey: "mysql-photo-1",
    variant: "thumbnail",
    expires: mediaUrl.searchParams.get("expires"),
    signature: mediaUrl.searchParams.get("signature"),
  };

  assert.equal(verifyGalleryMediaUrl(access, signingOptions), true);
  assert.equal(verifyGalleryMediaUrl({ ...access, storageKey: "mysql-photo-2" }, signingOptions), false);
  assert.equal(verifyGalleryMediaUrl({ ...access, variant: "image" }, signingOptions), false);
  assert.equal(verifyGalleryMediaUrl(access, { ...signingOptions, nowSeconds: 1_800_000_601 }), false);
});

test("Gallery media access rejects unsigned and overlong links", () => {
  assert.equal(verifyGalleryMediaUrl({
    storageKey: "mysql-photo-1",
    variant: "image",
    expires: 1_800_000_100,
    signature: "",
  }, signingOptions), false);

  const excessiveUrl = new URL(
    galleryMediaUrl("mysql-photo-1", "image", {
      ...signingOptions,
      ttlSeconds: 99_999,
    }),
    "https://api.example.test",
  );
  assert.equal(
    Number(excessiveUrl.searchParams.get("expires")),
    signingOptions.nowSeconds + 3600,
  );
});
