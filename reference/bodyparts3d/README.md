# BodyParts3D reference catalogue

This directory preserves the public BodyParts3D IS-A catalogue for data version
`20181210i412`.

- `20181210i412-objects.csv` is the portable source list with 8,129 catalogue objects.
- `catalog-data.js` contains the same fields in compact arrays for the local search page.
- `index.html` is a searchable view that works through `file://` and GitHub Pages.

The catalogue was retrieved on 2026-07-25 from the BodyParts3D viewer's public
`get-contents-list.cgi` endpoint using `mv_id=28`, `t_type=3`, and `bul_id=3`. Its response
reported 8,129 records, 8,129 unique FMA IDs, and 8,129 unique BP IDs.

These are anatomical catalogue objects, including compound concepts. They are not the same as
the viewer's OBJ-to-FMA export, which has 13,312 rows because several catalogue objects map to
multiple mesh representations.

To regenerate the committed CSV and browser data from a freshly retrieved JSON response:

```sh
node tools/build_bp3d_catalog.js source.json reference/bodyparts3d
```

Source: [BodyParts3D / Anatomography](https://lifesciencedb.jp/bp3d/)

Licence: BodyParts3D, © The Database Center for Life Science licensed under
CC Attribution-Share Alike 2.1 Japan.
