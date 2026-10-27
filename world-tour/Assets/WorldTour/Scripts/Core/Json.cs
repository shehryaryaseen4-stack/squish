using System;
using System.Collections.Generic;
using System.Globalization;
using System.Text;

namespace WorldTour.Core
{
    /// <summary>
    /// Minimal JSON reader/writer. Unity's JsonUtility cannot read top-level
    /// arrays, dictionaries or nested arrays, so the data layer uses this instead.
    /// Objects become Dictionary&lt;string, object&gt;, arrays List&lt;object&gt;,
    /// numbers double, plus string, bool and null.
    /// </summary>
    public static class Json
    {
        public static object Parse(string text)
        {
            if (text == null) throw new ArgumentNullException(nameof(text));
            var p = new Parser(text);
            p.SkipWhitespace();
            object value = p.ReadValue();
            p.SkipWhitespace();
            if (!p.AtEnd) throw p.Error("Unexpected trailing characters");
            return value;
        }

        public static string Write(object value)
        {
            var sb = new StringBuilder();
            WriteValue(sb, value);
            return sb.ToString();
        }

        static void WriteValue(StringBuilder sb, object value)
        {
            switch (value)
            {
                case null: sb.Append("null"); break;
                case string s: WriteString(sb, s); break;
                case bool b: sb.Append(b ? "true" : "false"); break;
                case int i: sb.Append(i.ToString(CultureInfo.InvariantCulture)); break;
                case long l: sb.Append(l.ToString(CultureInfo.InvariantCulture)); break;
                case float f: sb.Append(((double)f).ToString("R", CultureInfo.InvariantCulture)); break;
                case double d: sb.Append(d.ToString("R", CultureInfo.InvariantCulture)); break;
                case IDictionary<string, object> dict:
                    sb.Append('{');
                    bool first = true;
                    foreach (var kv in dict)
                    {
                        if (!first) sb.Append(',');
                        first = false;
                        WriteString(sb, kv.Key);
                        sb.Append(':');
                        WriteValue(sb, kv.Value);
                    }
                    sb.Append('}');
                    break;
                case System.Collections.IEnumerable list:
                    sb.Append('[');
                    bool firstItem = true;
                    foreach (var item in list)
                    {
                        if (!firstItem) sb.Append(',');
                        firstItem = false;
                        WriteValue(sb, item);
                    }
                    sb.Append(']');
                    break;
                default: throw new ArgumentException("Unsupported JSON type: " + value.GetType());
            }
        }

        static void WriteString(StringBuilder sb, string s)
        {
            sb.Append('"');
            foreach (char c in s)
            {
                switch (c)
                {
                    case '"': sb.Append("\\\""); break;
                    case '\\': sb.Append("\\\\"); break;
                    case '\n': sb.Append("\\n"); break;
                    case '\r': sb.Append("\\r"); break;
                    case '\t': sb.Append("\\t"); break;
                    default:
                        if (c < 0x20) sb.Append("\\u").Append(((int)c).ToString("x4"));
                        else sb.Append(c);
                        break;
                }
            }
            sb.Append('"');
        }

        sealed class Parser
        {
            readonly string s;
            int pos;

            public Parser(string text) { s = text; }

            public bool AtEnd => pos >= s.Length;

            public FormatException Error(string msg) => new FormatException(msg + " at position " + pos);

            public void SkipWhitespace()
            {
                while (pos < s.Length && char.IsWhiteSpace(s[pos])) pos++;
            }

            public object ReadValue()
            {
                if (AtEnd) throw Error("Unexpected end of JSON");
                char c = s[pos];
                switch (c)
                {
                    case '{': return ReadObject();
                    case '[': return ReadArray();
                    case '"': return ReadString();
                    case 't': Expect("true"); return true;
                    case 'f': Expect("false"); return false;
                    case 'n': Expect("null"); return null;
                    default:
                        if (c == '-' || (c >= '0' && c <= '9')) return ReadNumber();
                        throw Error("Unexpected character '" + c + "'");
                }
            }

            void Expect(string word)
            {
                if (string.CompareOrdinal(s, pos, word, 0, word.Length) != 0) throw Error("Expected " + word);
                pos += word.Length;
            }

            Dictionary<string, object> ReadObject()
            {
                var dict = new Dictionary<string, object>();
                pos++; // {
                SkipWhitespace();
                if (!AtEnd && s[pos] == '}') { pos++; return dict; }
                while (true)
                {
                    SkipWhitespace();
                    if (AtEnd || s[pos] != '"') throw Error("Expected object key");
                    string key = ReadString();
                    SkipWhitespace();
                    if (AtEnd || s[pos] != ':') throw Error("Expected ':'");
                    pos++;
                    SkipWhitespace();
                    dict[key] = ReadValue();
                    SkipWhitespace();
                    if (AtEnd) throw Error("Unterminated object");
                    if (s[pos] == ',') { pos++; continue; }
                    if (s[pos] == '}') { pos++; return dict; }
                    throw Error("Expected ',' or '}'");
                }
            }

            List<object> ReadArray()
            {
                var list = new List<object>();
                pos++; // [
                SkipWhitespace();
                if (!AtEnd && s[pos] == ']') { pos++; return list; }
                while (true)
                {
                    SkipWhitespace();
                    list.Add(ReadValue());
                    SkipWhitespace();
                    if (AtEnd) throw Error("Unterminated array");
                    if (s[pos] == ',') { pos++; continue; }
                    if (s[pos] == ']') { pos++; return list; }
                    throw Error("Expected ',' or ']'");
                }
            }

            string ReadString()
            {
                pos++; // opening quote
                var sb = new StringBuilder();
                while (true)
                {
                    if (AtEnd) throw Error("Unterminated string");
                    char c = s[pos++];
                    if (c == '"') return sb.ToString();
                    if (c != '\\') { sb.Append(c); continue; }
                    if (AtEnd) throw Error("Unterminated escape");
                    char e = s[pos++];
                    switch (e)
                    {
                        case '"': sb.Append('"'); break;
                        case '\\': sb.Append('\\'); break;
                        case '/': sb.Append('/'); break;
                        case 'b': sb.Append('\b'); break;
                        case 'f': sb.Append('\f'); break;
                        case 'n': sb.Append('\n'); break;
                        case 'r': sb.Append('\r'); break;
                        case 't': sb.Append('\t'); break;
                        case 'u':
                            if (pos + 4 > s.Length) throw Error("Bad unicode escape");
                            sb.Append((char)int.Parse(s.Substring(pos, 4), NumberStyles.HexNumber, CultureInfo.InvariantCulture));
                            pos += 4;
                            break;
                        default: throw Error("Bad escape '\\" + e + "'");
                    }
                }
            }

            double ReadNumber()
            {
                int start = pos;
                if (s[pos] == '-') pos++;
                while (pos < s.Length && "0123456789.eE+-".IndexOf(s[pos]) >= 0) pos++;
                if (!double.TryParse(s.Substring(start, pos - start), NumberStyles.Float, CultureInfo.InvariantCulture, out double d))
                    throw Error("Bad number");
                return d;
            }
        }
    }

    /// <summary>Typed accessors over parsed JSON objects.</summary>
    public static class JsonExt
    {
        public static Dictionary<string, object> Obj(this Dictionary<string, object> o, string key)
            => o != null && o.TryGetValue(key, out var v) ? v as Dictionary<string, object> : null;

        public static List<object> Arr(this Dictionary<string, object> o, string key)
            => o != null && o.TryGetValue(key, out var v) && v is List<object> l ? l : new List<object>();

        public static string Str(this Dictionary<string, object> o, string key, string fallback = null)
            => o != null && o.TryGetValue(key, out var v) && v is string s ? s : fallback;

        public static double Num(this Dictionary<string, object> o, string key, double fallback = 0)
            => o != null && o.TryGetValue(key, out var v) && v is double d ? d : fallback;

        public static int Int(this Dictionary<string, object> o, string key, int fallback = 0)
            => o != null && o.TryGetValue(key, out var v) && v is double d ? (int)Math.Round(d) : fallback;

        public static bool Bool(this Dictionary<string, object> o, string key, bool fallback = false)
            => o != null && o.TryGetValue(key, out var v) && v is bool b ? b : fallback;
    }
}
