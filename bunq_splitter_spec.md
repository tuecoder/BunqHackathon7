# bunq Trip Splitter — Claude Code Spec

## Project overview

A multimodal group expense splitter built on the bunq API. Friends on a trip upload photos of bills/receipts — AI extracts the items and amounts — they split either per-item or full-bill, see who owes what, and settle via bunq.me payment requests in one tap.

This is built for the **bunq Hackathon 7.0 (Multimodal AI)** and must use the bunq API from the cloned toolkit repo.

---

## Tech stack

- **Frontend**: React + Vite (single page app, no framework router needed)
- **Styling**: Tailwind CSS (CDN or installed)
- **Backend**: Python FastAPI (handles bunq API calls server-side to protect keys)
- **AI**: Anthropic Claude claude-sonnet-4-20250514 via `@anthropic-ai/sdk` or Python `anthropic` SDK — use vision to extract bill items
- **bunq SDK**: Clone and use `https://github.com/bunq/hackathon_toolkit` — reference its Python examples for auth + payment requests
- **Storage**: In-memory / localStorage for hackathon scope (no database needed)

---

## Repository structure

```
bunq-splitter/
├── backend/
│   ├── main.py              # FastAPI app
│   ├── bunq_client.py       # bunq API wrapper (built on hackathon_toolkit patterns)
│   ├── ai_extractor.py      # Claude vision bill extraction
│   ├── requirements.txt
│   └── .env                 # BUNQ_API_KEY, ANTHROPIC_API_KEY
├── frontend/
│   ├── src/
│   │   ├── App.jsx
│   │   ├── pages/
│   │   │   ├── GroupSetup.jsx      # Step 1: create group + add members
│   │   │   ├── BillsTab.jsx        # Step 2: upload bills, view extracted items
│   │   │   ├── SplitTab.jsx        # Step 3: choose split method per bill
│   │   │   └── SettleTab.jsx       # Step 4: balances + send payment requests
│   │   ├── components/
│   │   │   ├── BillCard.jsx        # Single bill with line items
│   │   │   ├── ItemRow.jsx         # One line item with payer selector
│   │   │   ├── BalanceSummary.jsx  # Who owes who
│   │   │   └── MemberChip.jsx      # Avatar + name chip
│   │   ├── store/
│   │   │   └── tripStore.js        # useState/useReducer global state
│   │   └── main.jsx
│   ├── index.html
│   └── package.json
└── README.md
```

---

## Backend API endpoints

### `POST /api/extract-bill`
Accepts a base64-encoded image of a receipt/bill. Calls Claude vision to extract line items.

**Request:**
```json
{
  "image_base64": "...",
  "image_type": "image/jpeg"
}
```

**Response:**
```json
{
  "merchant": "Albert Heijn",
  "date": "2026-04-24",
  "total": 34.80,
  "items": [
    { "id": "item_1", "name": "Heineken 6-pack", "price": 7.49, "quantity": 1 },
    { "id": "item_2", "name": "Pasta Bolognese", "price": 4.99, "quantity": 2 },
    { "id": "item_3", "name": "Sparkling water", "price": 1.89, "quantity": 3 }
  ],
  "currency": "EUR"
}
```

Claude prompt for extraction:
```
You are extracting line items from a receipt photo. Return ONLY valid JSON with this exact structure:
{
  "merchant": string,
  "date": "YYYY-MM-DD or null",
  "total": number,
  "currency": "EUR",
  "items": [{ "id": "item_N", "name": string, "price": number, "quantity": number }]
}
If an item has no clear price, estimate from the total. Never return anything outside the JSON.
```

### `POST /api/request-payment`
Creates a bunq.me payment request from one user to another.

**Request:**
```json
{
  "from_bunq_alias": "email@example.com",
  "amount": 12.50,
  "description": "Trip to Berlin – dinner at Vapiano (Prakash owes Sara)"
}
```

**Response:**
```json
{
  "request_id": "...",
  "bunq_me_url": "https://bunq.me/sara/12.50/Trip-to-Berlin"
}
```

Implement using `RequestInquiry` endpoint from the bunq API:
```
POST /v1/user/{userId}/monetary-account/{monetaryAccountId}/request-inquiry
```

### `GET /api/health`
Returns `{ "status": "ok" }` — for frontend to check backend is alive.

---

## Frontend — page by page

### Page 1: Group Setup (`GroupSetup.jsx`)

**UI elements:**
- Text input: "Trip name" (e.g. "Berlin April 2026")
- Section "Add members" — each member has:
  - Name (text input)
  - bunq email/alias (text input, optional — needed only for settle step)
  - Color avatar (auto-assigned from a palette of 6 colors)
  - "Add member" button → appends to list
  - Each member shown as a chip with remove (×) button
- "Who is paying from bunq?" — radio or toggle to mark which member is the logged-in bunq user (the one who will send payment requests)
- "Start trip" button → navigates to Bills tab

**State created:**
```js
{
  tripName: "Berlin April 2026",
  members: [
    { id: "m1", name: "Prakash", color: "#5B6CF9", bunqAlias: "prakash@tidalcontrol.com", isMe: true },
    { id: "m2", name: "Sara", color: "#E85D24", bunqAlias: "sara@example.com", isMe: false },
    { id: "m3", name: "Alex", color: "#1D9E75", bunqAlias: null, isMe: false }
  ]
}
```

---

### Page 2: Bills Tab (`BillsTab.jsx`)

**Tab layout:** Three tabs at top — "Bills" | "Split" | "Settle"

**Bills tab content:**
- Upload area: drag-and-drop or "tap to upload" — accepts jpg/png/heic
- On upload: show loading spinner with text "Reading receipt..."
- POST to `/api/extract-bill` with base64 image
- On success: render a `BillCard` component

**`BillCard` component:**
- Shows merchant name + date as card header
- Lists each extracted item as a row:
  - Item name, quantity, price
  - "Paid by" selector — dropdown or avatar chips to select which member paid for the whole bill
- Card footer: total amount, "Edit" button (allow manual correction of item names/prices)
- Multiple bills can be uploaded — each appears as a separate card
- Bills are scrollable in a vertical list

**"Paid by" logic:**
The person who physically paid the bill at the venue is selected here. This is separate from how it's split.

---

### Page 3: Split Tab (`SplitTab.jsx`)

For each bill, the user chooses a split method. Show each bill as a collapsible card.

**Split method toggle (per bill):**
Two options shown as segmented control:

**Option A — Split full bill equally**
- Show all members as toggleable chips
- Selected members = those who share this bill
- Shows calculated share per person below: "€X.XX each"

**Option B — Split per item**
- Show each item as a row
- Each item row has member chips — tap to assign who consumed that item (multiple people can share one item)
- If multiple people are assigned to an item, it splits equally among them
- Running total per member shown at bottom of card

**Live balance preview:**
At the bottom of the Split tab, a sticky footer shows a mini summary:
```
Sara owes €12.40  |  Alex owes €8.75  |  Prakash gets back €21.15
```
This updates live as selections change.

---

### Page 4: Settle Tab (`SettleTab.jsx`)

**Balance summary section:**
Show each member with:
- Their avatar chip + name
- Net balance: green "Gets back €X.XX" or red "Owes €X.XX"
- If balance is 0: grey "Settled"

**Settlement plan:**
Compute the minimum number of transfers to settle all debts (standard debt simplification algorithm):
1. Sort members by net balance
2. Pair highest positive with highest negative
3. Generate list of transactions: "Sara pays Prakash €12.40"

Show each transfer as a card:
- From member → To member
- Amount
- "Send request" button (if the logged-in user is the recipient)
- "Mark as settled manually" button (if the logged-in user isn't involved)

**"Send request" flow:**
- Calls `POST /api/request-payment`
- On success: button changes to "✓ Request sent" with the bunq.me URL shown as a copyable link
- Show a toast: "Payment request sent via bunq.me"

---

## State management (`tripStore.js`)

Use React `useContext` + `useReducer`. Shape:

```js
{
  trip: {
    name: "Berlin April 2026",
    members: [...],
    myMemberId: "m1"
  },
  bills: [
    {
      id: "bill_1",
      merchant: "Albert Heijn",
      date: "2026-04-24",
      total: 34.80,
      currency: "EUR",
      paidBy: "m2",           // member id who physically paid
      items: [...],
      splitMethod: "equal",   // "equal" | "per_item"
      splitConfig: {
        // for "equal": list of member ids included
        includedMembers: ["m1", "m2", "m3"],
        // for "per_item": map of item_id -> [member_ids]
        itemAssignments: {}
      }
    }
  ],
  settlements: [
    { from: "m2", to: "m1", amount: 12.40, status: "pending" }
  ]
}
```

---

## Balance calculation logic

Implement this pure JS function in `tripStore.js`:

```js
function calculateBalances(bills, members) {
  // 1. Build a map: memberId -> netBalance (positive = gets back, negative = owes)
  const balances = {};
  members.forEach(m => balances[m.id] = 0);

  bills.forEach(bill => {
    const payer = bill.paidBy;
    
    if (bill.splitMethod === "equal") {
      const share = bill.total / bill.splitConfig.includedMembers.length;
      bill.splitConfig.includedMembers.forEach(memberId => {
        if (memberId !== payer) {
          balances[payer] += share;   // payer gets back
          balances[memberId] -= share; // others owe
        }
      });
    }

    if (bill.splitMethod === "per_item") {
      bill.items.forEach(item => {
        const assigned = bill.splitConfig.itemAssignments[item.id] || [];
        if (assigned.length === 0) return;
        const share = (item.price * item.quantity) / assigned.length;
        assigned.forEach(memberId => {
          if (memberId !== payer) {
            balances[payer] += share;
            balances[memberId] -= share;
          }
        });
      });
    }
  });

  return balances; // e.g. { m1: 21.15, m2: -12.40, m3: -8.75 }
}

function computeSettlements(balances) {
  // Debt simplification: greedy pairing
  const creditors = Object.entries(balances).filter(([,v]) => v > 0.01).sort((a,b) => b[1]-a[1]);
  const debtors   = Object.entries(balances).filter(([,v]) => v < -0.01).sort((a,b) => a[1]-b[1]);
  const transfers = [];
  let i = 0, j = 0;
  while (i < creditors.length && j < debtors.length) {
    const [cId, cAmt] = creditors[i];
    const [dId, dAmt] = debtors[j];
    const amount = Math.min(cAmt, -dAmt);
    transfers.push({ from: dId, to: cId, amount: Math.round(amount * 100) / 100 });
    creditors[i][1] -= amount;
    debtors[j][1]  += amount;
    if (creditors[i][1] < 0.01) i++;
    if (debtors[j][1]  > -0.01) j++;
  }
  return transfers;
}
```

---

## bunq API integration (`bunq_client.py`)

Reference the cloned `hackathon_toolkit` repo for:
- API key setup and session registration
- Request signing (the toolkit handles this)
- Base URL and sandbox vs production toggle

Key pattern to follow from the toolkit:

```python
from bunq.sdk.context.api_context import ApiContext
from bunq.sdk.context.bunq_context import BunqContext
from bunq.sdk import client as bunq_client

def init_bunq(api_key: str, sandbox: bool = True):
    env = ApiEnvironmentType.SANDBOX if sandbox else ApiEnvironmentType.PRODUCTION
    api_context = ApiContext.create(env, api_key, "bunq Trip Splitter")
    api_context.save("bunq.conf")
    BunqContext.load_api_context(api_context)

def create_payment_request(monetary_account_id: int, amount: float, description: str, counterparty_alias: str):
    from bunq.sdk.model.generated.endpoint import RequestInquiry
    from bunq.sdk.model.generated.object_ import Amount, Pointer
    
    RequestInquiry.create(
        amount_inquired=Amount(str(round(amount, 2)), "EUR"),
        counterparty_alias=Pointer("EMAIL", counterparty_alias),
        description=description,
        allow_bunqme=True,
        monetary_account_id=monetary_account_id
    )
```

**Important:** Use sandbox mode during the hackathon. The toolkit README has instructions for getting a sandbox API key.

---

## UI/UX notes

- Color palette: use the bunq brand color `#00A86B` (bunq green) as primary accent
- Each member gets a distinct color (use a set of 6 predefined colors for avatars)
- Keep the UI mobile-first — judges may demo on phone
- Animate the balance numbers updating as split selections change (CSS transition on number)
- Show a progress indicator at the top: `Group → Bills → Split → Settle`
- Error states: if Claude fails to extract a bill, show "Couldn't read this receipt — add items manually" with a manual entry form
- Empty state for Bills tab: show a camera icon with "Upload your first receipt"

---

## Demo script for the hackathon

1. Open the app, create a group: "Berlin Trip" with 3 members
2. Upload a photo of a supermarket receipt → watch items appear
3. Upload a restaurant bill photo → second bill extracted
4. Switch to Split tab → set supermarket to "per item" (beer assigned to 2 people, food to all 3)
5. Set restaurant to "split equally" among all 3
6. Switch to Settle tab → show the net balances
7. Hit "Send request" → bunq.me link generated, paste in browser to show the payment page

Total demo time: ~90 seconds.

---

## What to build first (priority order)

1. Backend: `/api/extract-bill` with Claude vision — this is the core magic, test it standalone first
2. Frontend: Group setup + state store
3. Frontend: Bill upload → BillCard rendering (hardcode a fake API response initially)
4. Frontend: Split tab logic + balance calculation
5. Backend: `/api/request-payment` with bunq SDK
6. Frontend: Settle tab + "Send request" button
7. Polish: animations, error states, mobile layout

---

## Environment variables

```
# backend/.env
ANTHROPIC_API_KEY=sk-ant-...
BUNQ_API_KEY=...           # get from sandbox: https://tinker.bunq.com
BUNQ_SANDBOX=true
BUNQ_MONETARY_ACCOUNT_ID=... # printed after sandbox init
```

---

## Notes for Claude Code

- The hackathon toolkit repo is already cloned locally. Import from it using the patterns in its README.
- Keep the backend thin — it's a proxy for Claude vision + bunq. All business logic (balancing, splitting) lives in the frontend store.
- Do NOT use a database. Store everything in React state + localStorage so the app works without any setup beyond running the backend.
- The Anthropic API call for bill extraction must use `claude-sonnet-4-20250514` with `image` content blocks — not text.
- For the hackathon sandbox, bunq payment requests won't move real money. That's fine — the demo shows the flow.
