import assert from "node:assert/strict";
import test from "node:test";

process.env.DB_HOST ??= "127.0.0.1";
process.env.DB_USER ??= "test";
process.env.DB_PASSWORD ??= "test";
process.env.DB_NAME ??= "test";

const {
  assertGalleryAlbumWriteAccess,
  canCreateGalleryAlbums,
  canManageGalleryPhoto,
} = await import("../services/galleryService.js");

const unitLeader = {
  id: "12",
  role: "UNIT_LEADER",
  assignedUnits: [
    { id: 1, name: "مبتدئ" },
    { id: 2, name: "متقدم" },
  ],
};

test("Gallery album creation follows the operational role matrix", () => {
  assert.equal(canCreateGalleryAlbums({ role: "ADMIN" }), true);
  assert.equal(canCreateGalleryAlbums({ role: "GROUP_LEADER" }), true);
  assert.equal(canCreateGalleryAlbums(unitLeader), true);
  assert.equal(canCreateGalleryAlbums({ role: "SCOUT" }), false);
});

test("a Unit Leader manages only their own photos in assigned-unit albums", () => {
  assert.equal(canManageGalleryPhoto(unitLeader, {
    uploaded_by: 12,
    album_unit_id: 2,
    album_unit_name: "متقدم",
  }), true);
  assert.equal(canManageGalleryPhoto(unitLeader, {
    uploaded_by: 99,
    album_unit_id: 2,
    album_unit_name: "متقدم",
  }), false);
  assert.equal(canManageGalleryPhoto(unitLeader, {
    uploaded_by: 12,
    album_unit_id: 3,
    album_unit_name: "جوالة",
  }), false);
  assert.equal(canManageGalleryPhoto({ id: "1", role: "ADMIN" }, {
    uploaded_by: 99,
    album_unit_id: 3,
    album_unit_name: "جوالة",
  }), true);
  assert.equal(canManageGalleryPhoto({ id: "2", role: "SCOUT" }, {
    uploaded_by: 2,
    album_unit_id: 2,
    album_unit_name: "متقدم",
  }), false);
});

test("Gallery album writes reject global and unassigned albums for Unit Leaders", () => {
  assert.doesNotThrow(() => assertGalleryAlbumWriteAccess(unitLeader, {
    unit_id: 1,
    unit_name: "مبتدئ",
  }));
  assert.throws(
    () => assertGalleryAlbumWriteAccess(unitLeader, { unit_id: null, unit_name: null }),
    (error) => error.status === 403,
  );
  assert.throws(
    () => assertGalleryAlbumWriteAccess(unitLeader, { unit_id: 3, unit_name: "جوالة" }),
    (error) => error.status === 403,
  );
  assert.doesNotThrow(() => assertGalleryAlbumWriteAccess(
    { id: "1", role: "GROUP_LEADER" },
    { unit_id: null, unit_name: null },
  ));
});
