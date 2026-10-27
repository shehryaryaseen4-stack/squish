using System;
using System.Collections.Generic;

namespace WorldTour.Core
{
    /// <summary>
    /// Renders the country polygons into an RGBA image (equirectangular).
    /// Done once at startup instead of shipping a large map texture, so the
    /// map always matches countries.json.
    /// </summary>
    public static class MapRasterizer
    {
        static readonly byte[] Ocean = { 34, 74, 112 };
        static readonly byte[] Graticule = { 46, 88, 128 };
        static readonly byte[] Border = { 52, 52, 48 };

        static readonly Dictionary<string, byte[]> ContinentColors = new Dictionary<string, byte[]>
        {
            ["Asia"] = new byte[] { 196, 178, 128 },
            ["Europe"] = new byte[] { 160, 186, 140 },
            ["Africa"] = new byte[] { 206, 160, 112 },
            ["North America"] = new byte[] { 150, 176, 120 },
            ["South America"] = new byte[] { 130, 170, 110 },
            ["Oceania"] = new byte[] { 196, 150, 120 },
            ["Antarctica"] = new byte[] { 226, 232, 236 },
        };
        static readonly byte[] DefaultLand = { 180, 170, 140 };

        /// <param name="featuredCountries">Countries that have destinations; drawn brighter.</param>
        /// <param name="bottomUp">True to output row 0 = south (Unity texture layout).</param>
        public static byte[] Render(WorldDatabase db, int width, int height, ICollection<string> featuredCountries, bool bottomUp)
        {
            var px = new byte[width * height * 4];
            for (int i = 0; i < width * height; i++) Put(px, i, Ocean);

            // graticule every 30 degrees
            for (int lon = -180; lon <= 180; lon += 30)
            {
                int x = Math.Min(width - 1, (int)((lon + 180) / 360.0 * width));
                for (int y = 0; y < height; y++) Put(px, y * width + x, Graticule);
            }
            for (int lat = -60; lat <= 60; lat += 30)
            {
                int y = Math.Min(height - 1, (int)((90 - lat) / 180.0 * height));
                for (int x = 0; x < width; x++) Put(px, y * width + x, Graticule);
            }

            var xs = new List<double>();
            foreach (var c in db.Countries)
            {
                byte[] baseColor = ContinentColors.TryGetValue(c.Continent ?? "", out var cc) ? cc : DefaultLand;
                bool featured = featuredCountries != null && featuredCountries.Contains(c.Id);
                byte[] color = Tint(baseColor, c.Id, featured);
                FillCountry(px, width, height, c, color, xs);
            }
            foreach (var c in db.Countries)
                foreach (var ring in c.Rings)
                    StrokeRing(px, width, height, ring, Border);

            if (bottomUp) FlipRows(px, width, height);
            return px;
        }

        static byte[] Tint(byte[] baseColor, string id, bool featured)
        {
            // small deterministic variation so neighbouring countries are distinguishable
            int h = 17;
            foreach (char ch in id ?? "") h = h * 31 + ch;
            int delta = (h & 0x1f) - 16;
            var c = new byte[3];
            for (int i = 0; i < 3; i++)
            {
                int v = baseColor[i] + delta;
                if (featured) v = v + (255 - v) / 3;
                c[i] = (byte)Math.Max(0, Math.Min(255, v));
            }
            if (featured) c[2] = (byte)Math.Max(0, c[2] - 40); // warmer, golden tint
            return c;
        }

        static void FillCountry(byte[] px, int w, int h, Country c, byte[] color, List<double> xs)
        {
            int yStart = Math.Max(0, (int)Math.Floor((90 - c.MaxLat) / 180.0 * h));
            int yEnd = Math.Min(h - 1, (int)Math.Ceiling((90 - c.MinLat) / 180.0 * h));
            for (int y = yStart; y <= yEnd; y++)
            {
                double lat = 90 - (y + 0.5) / h * 180.0;
                xs.Clear();
                foreach (var ring in c.Rings)
                {
                    int n = ring.Length / 2;
                    for (int i = 0, j = n - 1; i < n; j = i++)
                    {
                        double lat1 = ring[i * 2 + 1], lat2 = ring[j * 2 + 1];
                        if ((lat1 > lat) == (lat2 > lat)) continue;
                        double lon1 = ring[i * 2], lon2 = ring[j * 2];
                        double lon = lon1 + (lat - lat1) / (lat2 - lat1) * (lon2 - lon1);
                        xs.Add((lon + 180) / 360.0 * w);
                    }
                }
                xs.Sort();
                for (int k = 0; k + 1 < xs.Count; k += 2)
                {
                    int x0 = Math.Max(0, (int)Math.Ceiling(xs[k] - 0.5));
                    int x1 = Math.Min(w - 1, (int)Math.Floor(xs[k + 1] - 0.5));
                    for (int x = x0; x <= x1; x++) Put(px, y * w + x, color);
                }
            }
        }

        static void StrokeRing(byte[] px, int w, int h, float[] ring, byte[] color)
        {
            int n = ring.Length / 2;
            for (int i = 0; i < n; i++)
            {
                int j = (i + 1) % n;
                int x0 = (int)((ring[i * 2] + 180) / 360.0 * w), y0 = (int)((90 - ring[i * 2 + 1]) / 180.0 * h);
                int x1 = (int)((ring[j * 2] + 180) / 360.0 * w), y1 = (int)((90 - ring[j * 2 + 1]) / 180.0 * h);
                if (Math.Abs(x1 - x0) > w / 2) continue; // segment along the antimeridian seam
                Line(px, w, h, x0, y0, x1, y1, color);
            }
        }

        static void Line(byte[] px, int w, int h, int x0, int y0, int x1, int y1, byte[] color)
        {
            int dx = Math.Abs(x1 - x0), sx = x0 < x1 ? 1 : -1;
            int dy = -Math.Abs(y1 - y0), sy = y0 < y1 ? 1 : -1;
            int err = dx + dy;
            while (true)
            {
                if (x0 >= 0 && x0 < w && y0 >= 0 && y0 < h) Put(px, y0 * w + x0, color);
                if (x0 == x1 && y0 == y1) break;
                int e2 = 2 * err;
                if (e2 >= dy) { err += dy; x0 += sx; }
                if (e2 <= dx) { err += dx; y0 += sy; }
            }
        }

        static void Put(byte[] px, int index, byte[] rgb)
        {
            int o = index * 4;
            px[o] = rgb[0]; px[o + 1] = rgb[1]; px[o + 2] = rgb[2]; px[o + 3] = 255;
        }

        static void FlipRows(byte[] px, int w, int h)
        {
            int stride = w * 4;
            var tmp = new byte[stride];
            for (int y = 0; y < h / 2; y++)
            {
                int a = y * stride, b = (h - 1 - y) * stride;
                Buffer.BlockCopy(px, a, tmp, 0, stride);
                Buffer.BlockCopy(px, b, px, a, stride);
                Buffer.BlockCopy(tmp, 0, px, b, stride);
            }
        }
    }
}
