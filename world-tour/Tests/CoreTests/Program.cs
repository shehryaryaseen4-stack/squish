using System;
using System.IO;
using System.IO.Compression;
using System.Linq;
using WorldTour.Core;

static class Program
{
    static int failures, passes;

    static void Check(bool ok, string name)
    {
        if (ok) passes++; else { failures++; Console.WriteLine("FAIL: " + name); }
    }

    static string DataDir => Path.Combine(AppContext.BaseDirectory, "../../../../../Assets/WorldTour/Resources/WorldTourData");

    static WorldDatabase LoadDb() => WorldDatabase.FromJson(
        File.ReadAllText(Path.Combine(DataDir, "countries.json")),
        File.ReadAllText(Path.Combine(DataDir, "airports.json")),
        File.ReadAllText(Path.Combine(DataDir, "destinations.json")),
        File.ReadAllText(Path.Combine(DataDir, "economy.json")));

    static int Main(string[] args)
    {
        var db = LoadDb();

        // --- data ---
        Check(db.Countries.Count > 150, "countries loaded");
        foreach (var id in new[] { "PAK", "FRA", "ARE", "JPN", "ITA", "GBR", "CHE" })
            Check(db.GetCountry(id) != null && db.DestinationsIn(id).Any(), "destinations in " + id);
        Check(db.Destinations.Count(d => d.IsExplorable) == 1, "exactly one explorable destination");
        var lahore = db.GetDestination("lahore");
        Check(lahore.IsExplorable && lahore.Environment.Landmarks.Count == 4, "lahore environment parsed");
        var pak = db.GetCountry("PAK");
        foreach (var d in db.Destinations)
        {
            var c = db.GetCountry(d.CountryId);
            Check(d.Lat >= c.MinLat - 1 && d.Lat <= c.MaxLat + 1 && d.Lon >= c.MinLon - 1 && d.Lon <= c.MaxLon + 1,
                  $"{d.Id} lies inside {c.Name} bounding box");
        }

        Check(db.CountryAt(31.55, 74.34)?.Id == "PAK" && db.CountryAt(48.86, 2.35)?.Id == "FRA" && db.CountryAt(35.68, 139.65)?.Id == "JPN", "country hit test");
        Check(db.CountryAt(10, -140) == null, "ocean hit test");

        // --- search ---
        Check(db.Search("lah").First().Id == "lahore", "search by name prefix");
        Check(db.Search("france").Any(d => d.Id == "paris"), "search by country");
        Check(db.Search("eiffel").First().Id == "paris", "search by landmark");
        Check(db.Search("HND").First().Id == "tokyo", "search by airport code");
        Check(db.Search("zzzz").Count == 0, "search no results");

        // --- geo ---
        double lonParis = GeoMath.DistanceKm(51.47, -0.454, 49.01, 2.548);
        Check(lonParis > 330 && lonParis < 360, $"LHR-CDG distance plausible ({lonParis:F0} km)");
        GeoMath.Interpolate(0, 0, 0, 90, 0.5, out double mlat, out double mlon);
        Check(Math.Abs(mlat) < 1e-6 && Math.Abs(mlon - 45) < 1e-6, "great circle midpoint");

        // --- economy / booking ---
        var profile = PlayerProfile.CreateNew(db.Economy);
        var travel = new TravelService(db, profile);
        Check(profile.Coins == 1500 && profile.CurrentDestinationId == "islamabad", "new profile defaults");

        var qParis = travel.Quote("paris");
        Check(!qParis.Available && qParis.Price > 0, "map-only destination is priced but not bookable");
        var qSelf = travel.Quote("islamabad");
        Check(!qSelf.Available, "cannot fly to current location");
        Check(!TravelService.HasRoute(db.GetAirport("GIL"), db.GetAirport("LHR")), "regional airport has no international route");
        Check(!TravelService.HasRoute(db.GetAirport("GIL"), db.GetAirport("KDU")), "no regional-regional route");
        Check(TravelService.HasRoute(db.GetAirport("GIL"), db.GetAirport("ISB")), "regional-domestic hub route");
        Check(travel.Quote("tokyo").International && travel.Quote("tokyo").Price > travel.Quote("karachi").Price, "longer international flight costs more");

        var q = travel.Quote("lahore");
        Check(q.Available && q.CanBook, "lahore bookable");
        int before = profile.Coins;
        var booking = travel.Book("lahore");
        Check(booking.Success && profile.Coins == before - q.Price, "booking deducts exact fare");
        Check(profile.History.Last().Amount == -q.Price && profile.History.Last().Category == TransactionCategory.Flight, "flight recorded in history");
        Check(!travel.Book("lahore").Success, "cannot double book during flight");

        // save mid-flight and restore
        var restored = PlayerProfile.FromJson(profile.ToJson(), db);
        Check(restored.ActiveTicket != null && restored.ActiveTicket.ToDestinationId == "lahore" && restored.Coins == profile.Coins, "mid-flight save restores ticket");

        int coinsBeforeLanding = profile.Coins;
        var arrival = travel.CompleteFlight();
        Check(arrival.FirstVisit && arrival.Reward == db.Economy.FirstVisitReward && profile.Coins == coinsBeforeLanding + arrival.Reward, "first visit reward");
        Check(profile.CurrentDestinationId == "lahore" && profile.ActiveTicket == null && profile.FlightsTaken == 1, "arrival updates location");

        var mosque = lahore.Environment.Landmarks.First(l => l.Type == "mosque");
        int c0 = profile.Coins;
        var v1 = travel.VisitLandmark(mosque);
        var v2 = travel.VisitLandmark(mosque);
        Check(v1.FirstVisit && v1.Reward == db.Economy.LandmarkReward && !v2.FirstVisit && v2.Reward == 0 && profile.Coins == c0 + v1.Reward, "landmark reward paid once");

        // insufficient funds
        var poor = PlayerProfile.CreateNew(db.Economy);
        poor.TrySpend(poor.Coins - 10, TransactionCategory.Other, "test");
        var poorTravel = new TravelService(db, poor);
        var poorBooking = poorTravel.Book("lahore");
        Check(!poorBooking.Success && poorBooking.Shortfall == q.Price - 10 && poor.Coins == 10, "shortfall reported, no coins taken");
        Check(poorTravel.EarningSuggestions().Count > 0, "earning suggestions offered");
        Check(!poor.TrySpend(11, TransactionCategory.Other, "x") && poor.Coins == 10, "TrySpend refuses overdraft");

        // save round trip
        var json = profile.ToJson();
        var p2 = PlayerProfile.FromJson(json, db);
        Check(p2.Coins == profile.Coins && p2.CurrentDestinationId == "lahore" && p2.VisitedLandmarks.Contains(mosque.Id)
              && p2.History.Count == profile.History.Count && p2.FlightsTaken == 1 && p2.TotalSpent == profile.TotalSpent, "save round trip");
        bool threw = false;
        try { PlayerProfile.FromJson("{\"version\":99}", db); } catch (FormatException) { threw = true; }
        Check(threw, "rejects unknown save version");

        // --- json ---
        var parsed = (System.Collections.Generic.Dictionary<string, object>)Json.Parse("{\"a\":[1,2.5,-3e2],\"s\":\"q\\\"\\u00e9\",\"n\":null,\"b\":true}");
        Check(parsed.Str("s") == "q\"\u00e9" && parsed.Arr("a").Count == 3 && (double)parsed.Arr("a")[2] == -300 && parsed.Bool("b"), "json parse");

        // --- viewport ---
        var vp = new MapViewport();
        vp.SetScreen(0, 0, 2000, 1000);
        vp.LatLonToScreen(0, 0, out double sx, out double sy);
        Check(Math.Abs(sx - 1000) < 1e-6 && Math.Abs(sy - 500) < 1e-6, "viewport centre");
        vp.ZoomAt(1500, 300, 4);
        vp.ScreenToWorld(1500, 300, out double u1, out double v1w);
        var vp2 = new MapViewport(); vp2.SetScreen(0, 0, 2000, 1000); vp2.ScreenToWorld(1500, 300, out double u0, out double v0);
        Check(Math.Abs(u1 - u0) < 1e-9 && Math.Abs(v1w - v0) < 1e-9 && vp.Zoom == 4, "zoom keeps point under cursor");
        vp.Pan(1e7, 1e7);
        vp.VisibleRect(out double um, out double vm, out _, out _);
        Check(um >= -1e-9 && vm >= -1e-9, "pan clamped to map");

        // --- raster ---
        var featured = db.Destinations.Select(d => d.CountryId).ToHashSet();
        var sw = System.Diagnostics.Stopwatch.StartNew();
        var px = MapRasterizer.Render(db, 2048, 1024, featured, false);
        sw.Stop();
        Console.WriteLine($"map raster 2048x1024 in {sw.ElapsedMilliseconds} ms");
        int Idx(double lat, double lon) => ((int)((90 - lat) / 180 * 1024) * 2048 + (int)((lon + 180) / 360 * 2048)) * 4;
        bool IsOcean(int i) => px[i] == 34 && px[i + 1] == 74 && px[i + 2] == 112;
        Check(!IsOcean(Idx(30, 70)), "Pakistan pixel is land");
        Check(IsOcean(Idx(10, -140)), "mid-Pacific pixel is ocean");
        if (args.Length > 0) WritePng(args[0], px, 2048, 1024);

        Console.WriteLine($"{passes} passed, {failures} failed");
        return failures == 0 ? 0 : 1;
    }

    static void WritePng(string path, byte[] rgba, int w, int h)
    {
        using var raw = new MemoryStream();
        for (int y = 0; y < h; y++) { raw.WriteByte(0); raw.Write(rgba, y * w * 4, w * 4); }
        byte[] idat;
        using (var ms = new MemoryStream())
        {
            using (var z = new ZLibStream(ms, CompressionLevel.Optimal, true)) raw.WriteTo(z);
            idat = ms.ToArray();
        }
        using var f = File.Create(path);
        f.Write(new byte[] { 137, 80, 78, 71, 13, 10, 26, 10 });
        void Chunk(string type, byte[] data)
        {
            var len = BitConverter.GetBytes(data.Length); Array.Reverse(len); f.Write(len);
            var t = System.Text.Encoding.ASCII.GetBytes(type); f.Write(t); f.Write(data);
            var crc = BitConverter.GetBytes(Crc(t.Concat(data).ToArray())); Array.Reverse(crc); f.Write(crc);
        }
        var ihdr = new byte[13];
        BitConverter.GetBytes(w).Reverse().ToArray().CopyTo(ihdr, 0);
        BitConverter.GetBytes(h).Reverse().ToArray().CopyTo(ihdr, 4);
        ihdr[8] = 8; ihdr[9] = 6;
        Chunk("IHDR", ihdr); Chunk("IDAT", idat); Chunk("IEND", new byte[0]);
    }

    static uint Crc(byte[] data)
    {
        uint c = 0xffffffff;
        foreach (byte b in data) { c ^= b; for (int k = 0; k < 8; k++) c = (c & 1) != 0 ? 0xedb88320 ^ (c >> 1) : c >> 1; }
        return c ^ 0xffffffff;
    }
}
