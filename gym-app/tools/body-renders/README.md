# Body type pictures

Renders the 24 pictures in `public/shapes/` from the MakeHuman 3D body
(assets released as CC0 by the MakeHuman project, so the pictures can be used
and sold freely). Clothes are painted on in a shader; the look of each body
(muscle, weight, belly) is set in `LOOKS` in `render.js`.

```sh
cd tools/body-renders
./fetch.sh                      # MakeHuman mesh, targets and weights (~7 MB, not kept in git)
npm install --no-save three@0.160.0
node render.js ../../public/shapes          # all 24, or add a name part: node render.js out male-now
```

Needs Playwright with Chromium.
