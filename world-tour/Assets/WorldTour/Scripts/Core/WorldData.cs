using System;
using System.Collections.Generic;
using System.Linq;

namespace WorldTour.Core
{
    public sealed class Country
    {
        public string Id;
        public string Name;
        public string Continent;
        public double LabelLon, LabelLat;
        /// <summary>Each ring is a flat [lon, lat, lon, lat, ...] array.</summary>
        public List<float[]> Rings = new List<float[]>();
        public double MinLon, MinLat, MaxLon, MaxLat;
    }

    public enum AirportType { International, Regional }

    public sealed class Airport
    {
        public string Code;
        public string Name;
        public string CountryId;
        public double Lat, Lon;
        public AirportType Type;
    }

    public enum DetailLevel { MapOnly, Explorable }

    public sealed class PointOfInterest
    {
        public string Name;
        public string Kind; // landmark, mountain, lake, coast, ...
        public double Lat, Lon;
    }

    public sealed class LandmarkSpec
    {
        public string Id;
        public string Name;
        public string Type;
        public float X, Z;
        public float Radius;
        public bool Park;
        public string Description;
    }

    /// <summary>Data that drives the procedural 3D area of an explorable destination.</summary>
    public sealed class EnvironmentSpec
    {
        public int Seed;
        public float HalfSize;
        public float BlockSize;
        public float RoadWidth;
        public float BuildingHeightMin, BuildingHeightMax;
        public string GroundColor, RoadColor, ParkColor;
        public List<string> BuildingColors = new List<string>();
        public float SpawnX, SpawnZ;
        public List<LandmarkSpec> Landmarks = new List<LandmarkSpec>();
    }

    public sealed class Destination
    {
        public string Id;
        public string Name;
        public string CountryId;
        public string Kind;
        public double Lat, Lon;
        public string AirportCode;
        public DetailLevel Detail;
        public string Description;
        public List<PointOfInterest> Pois = new List<PointOfInterest>();
        public EnvironmentSpec Environment;

        public bool IsExplorable => Detail == DetailLevel.Explorable && Environment != null;
    }

    public sealed class EconomyConfig
    {
        public int StartingCoins = 1500;
        public string StartingDestination;
        public double BaseFare = 80, PerKm = 0.12, InternationalSurcharge = 150, RegionalSurcharge = 40, MinimumFare = 120;
        public int FirstVisitReward = 200;
        public int LandmarkReward = 75;
    }

    /// <summary>
    /// All static world data (countries, airports, destinations, economy).
    /// Built from JSON text so it is independent of how the text is loaded
    /// (Unity Resources, a downloaded region pack, or a unit test).
    /// </summary>
    public sealed class WorldDatabase
    {
        public readonly List<Country> Countries = new List<Country>();
        public readonly List<Airport> Airports = new List<Airport>();
        public readonly List<Destination> Destinations = new List<Destination>();
        public EconomyConfig Economy = new EconomyConfig();
        public string MapSourceNote;

        readonly Dictionary<string, Country> countryById = new Dictionary<string, Country>();
        readonly Dictionary<string, Airport> airportByCode = new Dictionary<string, Airport>();
        readonly Dictionary<string, Destination> destinationById = new Dictionary<string, Destination>();

        public static WorldDatabase FromJson(string countriesJson, string airportsJson, string destinationsJson, string economyJson)
        {
            var db = new WorldDatabase();
            db.LoadCountries(countriesJson);
            db.LoadAirports(airportsJson);
            db.LoadDestinations(destinationsJson);
            db.LoadEconomy(economyJson);
            db.Validate();
            return db;
        }

        public Country GetCountry(string id) => id != null && countryById.TryGetValue(id, out var c) ? c : null;
        public Airport GetAirport(string code) => code != null && airportByCode.TryGetValue(code, out var a) ? a : null;
        public Destination GetDestination(string id) => id != null && destinationById.TryGetValue(id, out var d) ? d : null;

        public string CountryName(string id) => GetCountry(id)?.Name ?? id;

        /// <summary>Country containing the point (even-odd test over all rings), or null for ocean.</summary>
        public Country CountryAt(double lat, double lon)
        {
            foreach (var c in Countries)
            {
                if (lat < c.MinLat || lat > c.MaxLat || lon < c.MinLon || lon > c.MaxLon) continue;
                bool inside = false;
                foreach (var ring in c.Rings)
                {
                    int n = ring.Length / 2;
                    for (int i = 0, j = n - 1; i < n; j = i++)
                    {
                        double yi = ring[i * 2 + 1], yj = ring[j * 2 + 1];
                        if ((yi > lat) != (yj > lat) &&
                            lon < (ring[j * 2] - ring[i * 2]) * (lat - yi) / (yj - yi) + ring[i * 2])
                            inside = !inside;
                    }
                }
                if (inside) return c;
            }
            return null;
        }

        public IEnumerable<Destination> DestinationsIn(string countryId) => Destinations.Where(d => d.CountryId == countryId);

        /// <summary>
        /// Case-insensitive search over destination names, country names,
        /// airport codes/names and points of interest. Best matches first.
        /// </summary>
        public List<Destination> Search(string query, int max = 20)
        {
            query = (query ?? "").Trim();
            if (query.Length == 0) return Destinations.Take(max).ToList();
            var scored = new List<KeyValuePair<int, Destination>>();
            foreach (var d in Destinations)
            {
                int score = Score(d, query);
                if (score > 0) scored.Add(new KeyValuePair<int, Destination>(score, d));
            }
            return scored.OrderByDescending(kv => kv.Key).ThenBy(kv => kv.Value.Name)
                .Select(kv => kv.Value).Take(max).ToList();
        }

        int Score(Destination d, string q)
        {
            int best = 0;
            void Consider(string text, int weight)
            {
                if (string.IsNullOrEmpty(text)) return;
                int idx = text.IndexOf(q, StringComparison.OrdinalIgnoreCase);
                if (idx < 0) return;
                int s = weight + (idx == 0 ? 50 : 0) + (text.Length == q.Length ? 50 : 0);
                if (s > best) best = s;
            }
            Consider(d.Name, 300);
            Consider(CountryName(d.CountryId), 200);
            Consider(d.AirportCode, 180);
            Consider(GetAirport(d.AirportCode)?.Name, 120);
            foreach (var p in d.Pois) Consider(p.Name, 100);
            return best;
        }

        void LoadCountries(string json)
        {
            var root = (Dictionary<string, object>)Json.Parse(json);
            MapSourceNote = root.Str("source");
            foreach (Dictionary<string, object> c in root.Arr("countries"))
            {
                var country = new Country
                {
                    Id = c.Str("id"),
                    Name = c.Str("name"),
                    Continent = c.Str("continent"),
                    LabelLon = c.Num("labelLon"),
                    LabelLat = c.Num("labelLat"),
                    MinLon = 180, MinLat = 90, MaxLon = -180, MaxLat = -90,
                };
                foreach (List<object> ring in c.Arr("rings"))
                {
                    var arr = new float[ring.Count];
                    for (int i = 0; i < ring.Count; i++) arr[i] = (float)(double)ring[i];
                    for (int i = 0; i + 1 < arr.Length; i += 2)
                    {
                        country.MinLon = Math.Min(country.MinLon, arr[i]);
                        country.MaxLon = Math.Max(country.MaxLon, arr[i]);
                        country.MinLat = Math.Min(country.MinLat, arr[i + 1]);
                        country.MaxLat = Math.Max(country.MaxLat, arr[i + 1]);
                    }
                    country.Rings.Add(arr);
                }
                Countries.Add(country);
                if (country.Id != null) countryById[country.Id] = country;
            }
        }

        void LoadAirports(string json)
        {
            var root = (Dictionary<string, object>)Json.Parse(json);
            foreach (Dictionary<string, object> a in root.Arr("airports"))
            {
                var airport = new Airport
                {
                    Code = a.Str("code"),
                    Name = a.Str("name"),
                    CountryId = a.Str("country"),
                    Lat = a.Num("lat"),
                    Lon = a.Num("lon"),
                    Type = a.Str("type") == "regional" ? AirportType.Regional : AirportType.International,
                };
                Airports.Add(airport);
                airportByCode[airport.Code] = airport;
            }
        }

        void LoadDestinations(string json)
        {
            var root = (Dictionary<string, object>)Json.Parse(json);
            foreach (Dictionary<string, object> d in root.Arr("destinations"))
            {
                var dest = new Destination
                {
                    Id = d.Str("id"),
                    Name = d.Str("name"),
                    CountryId = d.Str("country"),
                    Kind = d.Str("kind", "city"),
                    Lat = d.Num("lat"),
                    Lon = d.Num("lon"),
                    AirportCode = d.Str("airport"),
                    Detail = d.Str("detail") == "explorable" ? DetailLevel.Explorable : DetailLevel.MapOnly,
                    Description = d.Str("description", ""),
                };
                foreach (Dictionary<string, object> p in d.Arr("pois"))
                    dest.Pois.Add(new PointOfInterest { Name = p.Str("name"), Kind = p.Str("kind", "landmark"), Lat = p.Num("lat"), Lon = p.Num("lon") });
                var env = d.Obj("environment");
                if (env != null) dest.Environment = ParseEnvironment(env);
                Destinations.Add(dest);
                destinationById[dest.Id] = dest;
            }
        }

        static EnvironmentSpec ParseEnvironment(Dictionary<string, object> e)
        {
            var spec = new EnvironmentSpec
            {
                Seed = e.Int("seed", 1),
                HalfSize = (float)e.Num("halfSize", 200),
                BlockSize = (float)e.Num("blockSize", 36),
                RoadWidth = (float)e.Num("roadWidth", 10),
                BuildingHeightMin = (float)e.Num("buildingHeightMin", 5),
                BuildingHeightMax = (float)e.Num("buildingHeightMax", 18),
                GroundColor = e.Str("groundColor", "#999080"),
                RoadColor = e.Str("roadColor", "#444444"),
                ParkColor = e.Str("parkColor", "#5E8C4A"),
            };
            foreach (var c in e.Arr("buildingColors")) if (c is string s) spec.BuildingColors.Add(s);
            var spawn = e.Arr("spawn");
            if (spawn.Count == 2) { spec.SpawnX = (float)(double)spawn[0]; spec.SpawnZ = (float)(double)spawn[1]; }
            foreach (Dictionary<string, object> l in e.Arr("landmarks"))
            {
                spec.Landmarks.Add(new LandmarkSpec
                {
                    Id = l.Str("id"),
                    Name = l.Str("name"),
                    Type = l.Str("type", "generic"),
                    X = (float)l.Num("x"),
                    Z = (float)l.Num("z"),
                    Radius = (float)l.Num("radius", 20),
                    Park = l.Bool("park"),
                    Description = l.Str("description", ""),
                });
            }
            return spec;
        }

        void LoadEconomy(string json)
        {
            var e = (Dictionary<string, object>)Json.Parse(json);
            var f = e.Obj("flight");
            var r = e.Obj("rewards");
            Economy = new EconomyConfig
            {
                StartingCoins = e.Int("startingCoins", 1500),
                StartingDestination = e.Str("startingDestination"),
                BaseFare = f.Num("baseFare", 80),
                PerKm = f.Num("perKm", 0.12),
                InternationalSurcharge = f.Num("internationalSurcharge", 150),
                RegionalSurcharge = f.Num("regionalSurcharge", 40),
                MinimumFare = f.Num("minimumFare", 120),
                FirstVisitReward = r.Int("firstVisit", 200),
                LandmarkReward = r.Int("landmarkVisit", 75),
            };
        }

        void Validate()
        {
            foreach (var d in Destinations)
            {
                if (GetAirport(d.AirportCode) == null)
                    throw new FormatException($"Destination '{d.Id}' references unknown airport '{d.AirportCode}'");
                if (GetCountry(d.CountryId) == null)
                    throw new FormatException($"Destination '{d.Id}' references unknown country '{d.CountryId}'");
            }
            if (GetDestination(Economy.StartingDestination) == null)
                throw new FormatException($"Unknown starting destination '{Economy.StartingDestination}'");
        }
    }
}
