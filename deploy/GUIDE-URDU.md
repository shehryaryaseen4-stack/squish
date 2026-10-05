# Flipit Free ko live karne ki guide (step by step)

Kul kharcha: server taqreeban $63/saal + domain taqreeban $10/saal. Waqt: 1 se 2 ghante (zyada tar intezar).

---

## Step 1: Cloudflare account (muft)

1. https://dash.cloudflare.com/sign-up pe email aur password se account banayein.
2. Email verify karein.

## Step 2: Domain khareedna

**Cloudflare se (behtar):**
1. Cloudflare dashboard mein baayein taraf **Domain Registration**, phir **Register Domains**.
2. Naam search karein, jaise `getflipfree.com`, `flipfree.app` ya `useflipfree.com`.
3. Khaali ho to **Purchase**, apni details bharein, card se payment karein.

Domain Cloudflare mein khud aa jayega, Step 4 ka "nameserver" wala hissa nahi karna.

**Agar Cloudflare pe card na chale:** https://porkbun.com se domain lein. Phir:
1. Cloudflare dashboard, **Add a domain**, apna domain likhein, **Free** plan chunein.
2. Cloudflare do nameservers dega (jaise `xxx.ns.cloudflare.com`).
3. Porkbun mein domain, **Authoritative Nameservers**, wahan purane hata kar Cloudflare wale dono likhein, Save.
4. 10 minute se kuch ghante mein Cloudflare email karega ke domain active hai.

## Step 3: Server khareedna (Contabo)

1. https://contabo.com/en/vps/ kholein.
2. **Cloud VPS 4** (4 vCPU, 8 GB RAM) pe **Get Started**. "VPS with Auto Backup" off rakhein.
3. Order page pe:
   - Region: **European Union (Germany)**
   - Image: **Ubuntu 24.04**
   - Panel: **None**
   - Root password: mazboot password, kahin likh lein
   - Baqi add-ons: **No**
4. Payment karein (debit card pe international payment on honi chahiye).
5. 15 minute se kuch ghante mein email aayega jis mein **IP address** hoga (jaise `185.123.45.67`).

## Step 4: Server pe website chalana (ek command)

**Server se judna:**
- Windows: Start menu mein **PowerShell** kholein.
- Mac: **Terminal** kholein.

Likhein (apna IP dalein):

```
ssh root@185.123.45.67
```

Pehli baar `yes` likh kar Enter dabayein, phir root password (likhte waqt dikhai nahi deta, yeh normal hai).

**Website chalana:** neeche wali do lines copy karein, `aapkadomain.com` aur email apne dalein, aur Enter dabayein:

```
curl -fsSL https://raw.githubusercontent.com/shehryaryaseen4-stack/squish/claude/cloudconvert-project-design-qzccpw/deploy/setup.sh -o setup.sh
bash setup.sh aapkadomain.com contact@aapkadomain.com
```

Pehli baar 10 se 20 minute lagenge (saare conversion engines install hote hain). Aakhir mein hara box aayega: "Flipit Free is running".

## Step 5: Cloudflare mein domain ko server se jorna

Cloudflare dashboard, apna domain:

1. **DNS**, phir **Records**, phir **Add record**:
   - Type `A`, Name `@`, IPv4 = server ka IP, Proxy status **Proxied** (orange cloud), Save
   - Type `A`, Name `www`, IPv4 = server ka IP, **Proxied**, Save
   - Agar pehle se koi `A` ya `CNAME` record `@` ya `www` ke liye ho to use delete kar dein.
2. **SSL/TLS**, phir **Overview**, encryption mode **Full** chunein. (Flexible nahi, warna page baar baar redirect hoga.)
3. **SSL/TLS**, phir **Edge Certificates**: **Always Use HTTPS** on.

5 se 10 minute baad `https://aapkadomain.com` kholein. Website live hai.

## Step 6: Contact email banana (AdSense ke liye zaroori)

1. Cloudflare, apna domain, **Email**, phir **Email Routing**, **Get started**.
2. Address `contact@aapkadomain.com`, destination apna Gmail. Gmail mein aaya verification link dabayein.
3. Cloudflare jo DNS records maange, **Add records** dabayein.

Ab is pate pe aane wali email aap ke Gmail mein aayegi. (Step 4 mein yahi email diya tha, to Contact page pe yeh dikh raha hoga.)

## Step 7: Google aur Bing ko batana

1. https://search.google.com/search-console, **Add property**, **Domain**, apna domain. Cloudflare wala option ho to "Verify with Cloudflare", warna TXT record Cloudflare DNS mein add karein.
2. Baayein **Sitemaps**: `sitemap.xml` likh kar **Submit**.
3. **URL inspection** mein 10 se 20 khaas pages (jaise `/jpg-to-png`, `/heic-to-jpg`, `/pdf-to-docx`) daal kar **Request indexing**.
4. https://www.bing.com/webmasters pe **Import from Google Search Console** se yahi sab ek click mein.

## Step 8: AdSense (2 se 4 hafte baad)

1. https://adsense.google.com pe apply karein, site ka URL dein.
2. Approval ke baad apni publisher ID (`ca-pub-...`) server pe lagayein:

```
ssh root@SERVER-IP
nano /opt/flipfree/.env
```

`ADSENSE_CLIENT=` ke aage apni ID likhein. `Ctrl+O`, Enter, `Ctrl+X`. Phir:

```
bash /opt/flipfree/deploy/update.sh
```

3. AdSense mein **Auto ads** on karein, aur **Privacy & messaging** mein GDPR message publish karein.

---

## Baad ke kaam

| Kaam | Command (server pe) |
|---|---|
| Naya code GitHub se lena | `bash /opt/flipfree/deploy/update.sh` |
| Settings badalna | `nano /opt/flipfree/.env`, phir update wali command |
| Site ke logs dekhna | `docker logs -f flipfree` (band karne ke liye `Ctrl+C`) |
| Site restart | `docker restart flipfree` |

## Masle aur hal

| Masla | Hal |
|---|---|
| "Too many redirects" | Cloudflare SSL mode **Full** karein, Flexible nahi. |
| Error 521 / 522 | Server band hai ya site nahi chal rahi: `docker ps` dekhein, `docker restart flipfree`. |
| Error 524 | Bohot bari video 100 second se zyada le rahi thi; choti file try karein. |
| Domain nahi khul raha | Naye domain/DNS mein kuch ghante lag sakte hain. Cloudflare mein `A` records aur orange cloud check karein. |
| Script beech mein ruk gayi | Dobara wahi command chalayein, yeh safe hai. |
