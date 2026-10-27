using System;

namespace WorldTour.Core
{
    public static class GeoMath
    {
        public const double EarthRadiusKm = 6371.0;

        /// <summary>Great-circle distance in kilometres (haversine).</summary>
        public static double DistanceKm(double lat1, double lon1, double lat2, double lon2)
        {
            double dLat = ToRad(lat2 - lat1);
            double dLon = ToRad(lon2 - lon1);
            double a = Math.Sin(dLat / 2) * Math.Sin(dLat / 2) +
                       Math.Cos(ToRad(lat1)) * Math.Cos(ToRad(lat2)) * Math.Sin(dLon / 2) * Math.Sin(dLon / 2);
            return 2 * EarthRadiusKm * Math.Asin(Math.Min(1, Math.Sqrt(a)));
        }

        /// <summary>Point at fraction t (0..1) along the great circle between two points.</summary>
        public static void Interpolate(double lat1, double lon1, double lat2, double lon2, double t, out double lat, out double lon)
        {
            double p1 = ToRad(lat1), l1 = ToRad(lon1), p2 = ToRad(lat2), l2 = ToRad(lon2);
            double d = DistanceKm(lat1, lon1, lat2, lon2) / EarthRadiusKm;
            if (d < 1e-9) { lat = lat1; lon = lon1; return; }
            double a = Math.Sin((1 - t) * d) / Math.Sin(d);
            double b = Math.Sin(t * d) / Math.Sin(d);
            double x = a * Math.Cos(p1) * Math.Cos(l1) + b * Math.Cos(p2) * Math.Cos(l2);
            double y = a * Math.Cos(p1) * Math.Sin(l1) + b * Math.Cos(p2) * Math.Sin(l2);
            double z = a * Math.Sin(p1) + b * Math.Sin(p2);
            lat = ToDeg(Math.Atan2(z, Math.Sqrt(x * x + y * y)));
            lon = ToDeg(Math.Atan2(y, x));
        }

        /// <summary>Equirectangular projection to normalised map coords (u right, v down), both 0..1.</summary>
        public static void Project(double lat, double lon, out double u, out double v)
        {
            u = (lon + 180.0) / 360.0;
            v = (90.0 - lat) / 180.0;
        }

        public static void Unproject(double u, double v, out double lat, out double lon)
        {
            lon = u * 360.0 - 180.0;
            lat = 90.0 - v * 180.0;
        }

        static double ToRad(double deg) => deg * Math.PI / 180.0;
        static double ToDeg(double rad) => rad * 180.0 / Math.PI;
    }
}
