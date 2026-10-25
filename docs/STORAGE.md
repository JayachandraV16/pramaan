# Storage: where uploaded files live

Everything uploaded (nameplate photos, inspection photos, documents, reply attachments) and every certificate PDF goes through `utils/storage.js`. The database keeps only the reference (`/uploads/<key>`) and, since migration 034, the facts about each upload in `stored_files`.

| | Development (default) | Production option |
|---|---|---|
| Driver | `STORAGE_DRIVER=local` (files under `UPLOAD_DIR`) | `STORAGE_DRIVER=s3` (AWS S3, MinIO, Cloudflare R2 or any S3-compatible bucket) |
| Access | the API serves `/uploads/...` only with a signed, expiring link | the bucket stays private; the API still signs the links |
| Settings | none | `S3_BUCKET`, `S3_REGION`, `S3_ENDPOINT`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_FORCE_PATH_STYLE`, `S3_PREFIX`, `S3_SERVER_SIDE_ENCRYPTION` |

## What happens to an upload

1. Type check by extension and by the file's first bytes; 10 MB limit.
2. Pictures must decode (a damaged file, or one with an absurd pixel count, is refused with a 400). The bytes are **not** changed, so the SHA-256 shown to people is the SHA-256 of what was sent.
3. The server computes the SHA-256, stores the file and writes a `stored_files` row: key, kind, MIME type, size, SHA-256, picture size, camera orientation, driver, uploader.
4. If the request is then refused (access denied, bad input), the file and the row are removed again.

Rotation: the camera orientation is recorded, not baked in. Browsers show the photo upright; the OCR and QR paths turn it themselves.

## The tools (all in `api/`, all safe by default)

```bash
npm run storage:audit                      # stored files vs what the database refers to
npm run storage:audit -- --backfill        # also add metadata rows for files uploaded before migration 034
npm run storage:cleanup                    # DRY RUN: lists unreferenced files older than 24 h
npm run storage:cleanup -- --apply         # deletes them (and their metadata rows)
npm run storage:migrate -- --from=local --to=s3            # DRY RUN
npm run storage:migrate -- --from=local --to=s3 --apply    # copy, then verify each copy by SHA-256
```

Exit code 0 = nothing to worry about, 2 = a problem was found (referenced files missing, conflicts or failed copies), 1 = the tool could not run.

* **audit** reports: files and bytes, files the database refers to, orphans (unreferenced and older than `--min-age-hours`, so uploads still in progress are not counted), referenced-but-missing files, files without a metadata row, metadata rows without a file.
* **cleanup** never touches a referenced file or a young one.
* **migrate** never changes or deletes the source, never overwrites a different file on the target (it reports a conflict), skips files already there with identical content (so it can be re-run safely), and removes a target copy that does not read back identically.

## Moving to S3 (checklist)

1. Create a **private** bucket (optionally with versioning and a lifecycle rule) and a key that can only read, write, list and delete in that bucket/prefix.
2. Put the `S3_*` settings in `api/.env`, but leave `STORAGE_DRIVER=local`.
3. `npm run storage:audit` and fix anything reported as missing.
4. `npm run storage:migrate -- --from=local --to=s3` (dry run), then again with `--apply`. Run it twice: the second run should say everything is already there.
5. Set `STORAGE_DRIVER=s3`, restart, open a few certificates and photos.
6. Keep the local folder as a backup until you are satisfied; files uploaded between step 4 and step 5 are picked up by running the migration once more.
7. Rollback: set `STORAGE_DRIVER=local` again (the local copy is untouched); `--from=s3 --to=local` copies anything new back.

## Not done / not tested

* Tested with an in-memory S3 client only; not against a real bucket, MinIO or R2.
* No thumbnails or re-encoding (originals only).
* Backups of the bucket and the database are the operator's job; restore is not exercised.
