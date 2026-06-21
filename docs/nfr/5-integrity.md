# Non-functional requirement 5 — File Integrity

### Definition: During import, preview, and deletion from the workspace, the application must not corrupt original files without justification. Writing metadata is the only permitted file modification — it may slightly change the file size, but the visual pixel data must remain completely unchanged and must not lose quality.

## Test Data

- File used for pixel identity test: `Avatar.jpg` (93,182 bytes)
- File with metadata written: `Avatar_with_metadata.jpg` (96,894 bytes)
- Image dimensions: 640×640 pixels (409,600 pixels total)

---

## Test 1 — Safe Delete

### Expected Result

After deleting files from the application workspace, the original physical files on disk must remain completely untouched — same count, same SHA-256 hashes, same sizes.

### Verification Method

1. Record the file count and SHA-256 hashes of all files in the test folder on disk.
2. Import the files into the application.
3. Delete the files from the workspace using the application UI.
4. Check the test folder on disk — verify that all files are still present and their hashes match the values recorded before the test.

### Actual Result

- Files present on disk before deletion: 1
- Files present on disk after deletion from workspace: 1
- Hashes match: yes
- Result: **passed**

Screenshot before import:

![Before import](./photos/Before_import.png)

Screenshot of imported file in workspace:

![Imported](./photos/Imported.png)

Screenshot after deletion from workspace:

![After delete check](./photos/After_delete_check.png)

Deletion confirmation:

![Deleting](./photos/Deleting.png)

### Conclusion

The application does not delete or modify physical files on disk when removing them from the workspace. The file integrity requirement for the delete operation is satisfied.

---

## Test 2 — Pixel Identity

### Expected Result

After writing metadata to a JPEG file via the application (US-2.8), the file size may increase slightly due to added text tags. However, every pixel in the image must remain byte-for-byte identical to the original — no recompression, no quality loss.

### Verification Method

1. Take the original photo and compute its SHA-256 hash.
2. Write metadata (title, description, tags) to the file using the application.
3. Run `pixel_identity_check.py` to compare the original and tagged files pixel by pixel.
4. Confirm that the number of changed pixels is 0.

### Actual Result

```
──────────────────────────────────────────────────────
  PIXEL IDENTITY CHECK
──────────────────────────────────────────────────────
  ·  Original  : Avatar.jpg  (93,182 bytes)
  ·  Tagged    : Avatar_with_metadata.jpg  (96,894 bytes)
  ·  Size diff : +3,712 bytes  (tags added — expected)

1 / SHA-256 hashes
  ·  Original  : 016275e2556f64a98ec61238d285b70670455b2ab7bd6ac08bb9b067f6bda9fd
  ·  Tagged    : 135f19a156f908264a819b2471d656c522d8d9420a40814a44452636025a22c2
  !  Hashes differ (expected — metadata/file structure changed)

2 / Pixel comparison
  ·  Dimensions: 640×640  (409,600 pixels total)
  ✓  Changed pixels: 0 — full pixel identity ✓

3 / Metadata diff
  ✓  Tag added   [exif:ImageDescription] = 'White face in front of white tree'
  ✓  Tag added   [exif:XPTitle] = 'Handsome abituruient'
  ✓  Tag added   [exif:XPSubject] = 'Handsome abituruient'
  ✓  Tag added   [exif:XPKeywords] = 'human'
  ✓  Tag added   [exif:XPComment] = 'White face in front of white tree'
  ✓  Tag added   [info:photoshop] = (IPTC block)
  ✓  Tag added   [info:xmp] = (XMP packet)
  ✓  Tag added   [exif:XResolution] = '72.0'
  ✓  Tag added   [exif:YResolution] = '72.0'
  ✓  Tag added   [exif:ResolutionUnit] = '2'
  ✓  Tag added   [exif:YCbCrPositioning] = '1'
  ✓  Tag added   [exif:ExifOffset] = '348'
  ·  Unchanged fields: 0

VERDICT
──────────────────────────────────────────────────────
  ✓  TEST PASSED
     Pixels are identical. Only metadata changed.
     Image quality and compression are 100% original.
```

- Changed pixels: 0 out of 409,600
- File size increase: +3,712 bytes (metadata tags only)
- SHA-256 hashes differ: expected — metadata/file structure changed
- Result: **passed**

Screenshot of metadata written in the application:

![Avatar with metadata](./photos/Avatar_with_metadata.jpg)

### Conclusion

The application writes metadata without recompressing or modifying pixel data in any way. The file size increase of 3,712 bytes is fully accounted for by the added EXIF/XMP/IPTC tags. All 409,600 pixels remain byte-for-byte identical to the original. The pixel identity requirement is satisfied.

---

## Overall Conclusion

Both integrity tests passed. The application does not corrupt, delete, or recompress original files during import, preview, deletion, or metadata editing. File integrity is maintained throughout all tested operations.