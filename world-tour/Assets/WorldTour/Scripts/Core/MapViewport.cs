using System;

namespace WorldTour.Core
{
    /// <summary>
    /// Zoom/pan state of the 2D world map. Map space is normalised (u right, v down,
    /// 0..1) on a 2:1 equirectangular image. Screen space is pixels, y down
    /// (matches Unity IMGUI).
    /// </summary>
    public sealed class MapViewport
    {
        public double ScreenX, ScreenY, ScreenW = 1, ScreenH = 1;
        public double Zoom { get; private set; } = 1;
        public double CenterU { get; private set; } = 0.5;
        public double CenterV { get; private set; } = 0.5;
        public double MinZoom = 1, MaxZoom = 24;

        /// <summary>Width in pixels of the whole map at the current zoom.</summary>
        public double MapWidthPx => Math.Max(ScreenW, ScreenH * 2) * Zoom;
        public double MapHeightPx => MapWidthPx / 2;

        public void SetScreen(double x, double y, double w, double h)
        {
            ScreenX = x; ScreenY = y; ScreenW = Math.Max(1, w); ScreenH = Math.Max(1, h);
            Clamp();
        }

        public void WorldToScreen(double u, double v, out double sx, out double sy)
        {
            sx = ScreenX + ScreenW / 2 + (u - CenterU) * MapWidthPx;
            sy = ScreenY + ScreenH / 2 + (v - CenterV) * MapHeightPx;
        }

        public void ScreenToWorld(double sx, double sy, out double u, out double v)
        {
            u = CenterU + (sx - ScreenX - ScreenW / 2) / MapWidthPx;
            v = CenterV + (sy - ScreenY - ScreenH / 2) / MapHeightPx;
        }

        public void LatLonToScreen(double lat, double lon, out double sx, out double sy)
        {
            GeoMath.Project(lat, lon, out double u, out double v);
            WorldToScreen(u, v, out sx, out sy);
        }

        public void Pan(double dxPixels, double dyPixels)
        {
            CenterU -= dxPixels / MapWidthPx;
            CenterV -= dyPixels / MapHeightPx;
            Clamp();
        }

        /// <summary>Zooms by factor keeping the map point under (sx, sy) fixed on screen.</summary>
        public void ZoomAt(double sx, double sy, double factor)
        {
            ScreenToWorld(sx, sy, out double u, out double v);
            Zoom = Math.Max(MinZoom, Math.Min(MaxZoom, Zoom * factor));
            CenterU = u - (sx - ScreenX - ScreenW / 2) / MapWidthPx;
            CenterV = v - (sy - ScreenY - ScreenH / 2) / MapHeightPx;
            Clamp();
        }

        public void CenterOn(double lat, double lon, double zoom)
        {
            Zoom = Math.Max(MinZoom, Math.Min(MaxZoom, zoom));
            GeoMath.Project(lat, lon, out double u, out double v);
            CenterU = u; CenterV = v;
            Clamp();
        }

        /// <summary>Visible part of the map in normalised coords (top-left origin).</summary>
        public void VisibleRect(out double uMin, out double vMin, out double uWidth, out double vHeight)
        {
            uWidth = ScreenW / MapWidthPx;
            vHeight = ScreenH / MapHeightPx;
            uMin = CenterU - uWidth / 2;
            vMin = CenterV - vHeight / 2;
        }

        void Clamp()
        {
            double halfU = ScreenW / MapWidthPx / 2;
            double halfV = ScreenH / MapHeightPx / 2;
            CenterU = halfU >= 0.5 ? 0.5 : Math.Max(halfU, Math.Min(1 - halfU, CenterU));
            CenterV = halfV >= 0.5 ? 0.5 : Math.Max(halfV, Math.Min(1 - halfV, CenterV));
        }
    }
}
