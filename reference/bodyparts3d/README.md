# BodyParts3D reference catalogue

This directory preserves the public BodyParts3D IS-A catalogue for data version
`20181210i412`.

- `20181210i412-objects.csv` is the portable source list with 8,129 catalogue objects.
- `catalog-data.js` contains the same fields in compact arrays for the local search page.
- `resus-inventory.json` records the evidence used to identify objects already present.
- `index.html` is a searchable view that works through `file://` and GitHub Pages.

The catalogue was retrieved on 2026-07-25 from the BodyParts3D viewer's public
`get-contents-list.cgi` endpoint using `mv_id=28`, `t_type=3`, and `bul_id=3`. Its response
reported 8,129 records, 8,129 unique FMA IDs, and 8,129 unique BP IDs.

These are anatomical catalogue objects, including compound concepts. They are not the same as
the viewer's OBJ-to-FMA export, which has 13,312 rows because several catalogue objects map to
multiple mesh representations.

## Resus inventory columns

The CSV columns `in_resus`, `resus_modules`, `resus_source_versions`, `inventory_match`,
`availability_status`, and `needs_download` compare each catalogue object with the models
currently embedded in Resus.
The audit is deliberately conservative:

- FMA IDs retained in model sources are accepted directly.
- FJ/MM/CX source IDs are resolved through the official `20181210i412` OBJ-to-FMA export.
- Exact normalized names are accepted only in model files that explicitly identify themselves
  as BodyParts3D.
- Similarly named Open3DModel geometry is not treated as the same BodyParts3D object.

Consequently, `in_resus=no` means that the audit found no reliable provenance match. It may
include a small number of false negatives where old merge steps discarded all source IDs.

The 2026-07-25 audit securely identifies 332 catalogue concepts in Resus and leaves 7,797
available to integrate. Of the missing entries, 4,279 are primitive elements and 3,518 are
compound concepts. For a local source library, the primitive elements are the important first
integration set; many compound concepts can be reconstructed from their constituent elements.

To regenerate the committed CSV and browser data from a freshly retrieved JSON response:

```sh
node tools/audit_bp3d_inventory.js . source.json obj-to-fma.html \
  reference/bodyparts3d/resus-inventory.json
node tools/build_bp3d_catalog.js source.json reference/bodyparts3d \
  reference/bodyparts3d/resus-inventory.json
```

Source: [BodyParts3D / Anatomography](https://lifesciencedb.jp/bp3d/)

Licence: BodyParts3D, © The Database Center for Life Science licensed under
CC Attribution-Share Alike 2.1 Japan.
