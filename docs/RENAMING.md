# Renaming the product

The name has changed twice already, so this is written down properly.

**The whole job is five files and one environment variable, and takes about
five minutes.** Everything a user reads comes from one constant; the exceptions
below exist only because those files cannot import TypeScript.

---

## The one edit that does almost everything

`src/lib/brand.ts`:

```ts
export const BRAND = {
  name: 'Nitrate',      // full name, used where there's room
  short: 'Nitrate',     // tight spots: top nav, email header
  initials: 'N',        // logo mark
  tagline: '…',
  description: '…',     // meta description, share cards
  clubsPitch: '…',      // how Movie Clubs are described in marketing copy
} as const;
```

That single edit covers **every screen and every email**: page titles, the
nav wordmark, the landing page, onboarding, terms and guidelines, share sheets,
email headers and footers, and Open Graph metadata. Nothing else in `src/` hard-codes
the name — `grep -rn "BRAND\." src` shows the ~20 places that read it.

---

## The five things that can't read `brand.ts`

Each one is a plain string in a file that has no access to TypeScript.

| File | What to change | Why it's separate |
| --- | --- | --- |
| `src/app/icon.svg` | The single letter in `<text>` — the first initial | A static file served as the favicon; it cannot import anything |
| `src/app/globals.css` | The name in the header comment | Cosmetic, but it's the first line a designer reads |
| `src/server/db/schema.ts` | The name in the header comment | Same |
| `package.json` | `"name"` — lowercase, hyphenated | npm requires lowercase with no spaces |
| `EMAIL_FROM` (env var) | The display name before the `<address>` | Lives in Vercel and `.env.local`, not in the repo |

`EMAIL_FROM` is the one people forget, and it's the most visible: it's the
sender name in your friends' inboxes, shown before they open anything.

```bash
printf 'Nitrate <movienight@nhihadhassan.ca>' \
  | npx vercel env add EMAIL_FROM production --force --token "$VERCEL_TOKEN"
```

Update `.env.local` to match, then redeploy. The email address itself does not
need to change — any address on the verified domain works.

---

## A club name is not the product name

The reason this file exists twice over: the product was once branded as a single
club, so the club's name appeared in the browser tab, the nav, the footer, every
email and every share card. `BRAND` is the *application*; a club has its own
`name` column and names only its own page (`/club/[slug]` sets its title from
that, and the template still appends the product name). If you ever want
`BRAND.name` to vary per club, you want the club's `name` instead.

## What deliberately does *not* change

Renaming these costs a data migration and signs everyone out, and no user ever
sees them:

- the `nitrate` Postgres schema and the `nitrate_app` role
- the `nitrate_session` cookie and the `nitrate-theme` localStorage key
- the `nitrate-*` CSS animation names
- the GitHub repo, the Vercel project, and therefore the live URL

The URL is the only one of these a user might notice. Changing it needs
account-level Vercel permissions and breaks any link already shared.

---

## Checklist

```bash
# 1. Edit src/lib/brand.ts, then the five exceptions above.

# 2. Nothing should be left. Both greps should return only false positives.
grep -rn "OldName" src docs README.md package.json
grep -rin "oldinitials" src            # "turbulence" in globals.css matches "bule" — ignore it

# 3. Verify and ship.
npm run verify
npx vercel env add EMAIL_FROM production --force --token "$VERCEL_TOKEN"
npx vercel deploy --prod --token "$VERCEL_TOKEN" --yes
```

Then load the site and check three surfaces, because they read from three
different places: the **browser tab** (metadata), the **top-left wordmark**
(component), and the **sender name on a test email** (env var).
