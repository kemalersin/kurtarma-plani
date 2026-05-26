/** AI sistem promptuna eklenen kayıt önerisi format rehberi. */
export const AI_PROPOSAL_GUIDE = `## Kayıt önerisi formatı (zorunlu)

Kullanıcı veri eklemek istediğinde (ekran görüntüsü, tablo, talimat) yanıtına **mutlaka** aşağıdaki JSON bloğunu ekle. Açıklama metni bloğun dışında kalabilir.

\`\`\`kp-proposals
{
  "version": 1,
  "items": [ ... ]
}
\`\`\`

### Genel kurallar

- \`id\`, \`createdAt\`, \`updatedAt\` **yazma** — uygulama üretir.
- Faiz oranları **ondalık kesir** (4,25 % → \`0.0425\`), yüzde değil.
- Tarihler ISO 8601 (\`2025-03-15\` veya tam ISO).
- Para birimi 3 harf (\`TRY\`); belirtilmezse profil para birimi kullanılır.
- Tutarlar **pozitif sayı** (\`amount\`, \`principal\`, \`limit\` vb.).
- Enum değerleri **İngilizce ve tam eşleşmeli** (Türkçe yazma): örn. \`purchase\`, \`monthly\`, \`checking\`.
- Eksik zorunlu alan varsa JSON üretme; kullanıcıya sor.
- Her kayıt \`items\` dizisinde **ayrı bir öğe** olmalı; hareketleri kart/hesap nesnesinin içine gömme.

### İlişki alanları

- **Aynı batch:** önce ana kayda \`ref\` ver; bağlı kayıtlarda \`*Ref\` kullan (\`bankRef\`, \`cardRef\`, \`loanRef\` …).
- **Mevcut kayıt (snapshot'taki):** doğrudan \`*Id\` (snapshot \`entities[].id\`) veya \`*Name\` (kayıt adıyla eşleşme).
- Desteklenen ad çözümlemeleri: \`bankName\`, \`accountName\`, \`cashRegisterName\`, \`incomeTypeName\`, \`expenseTypeName\`, \`loanName\`, \`cardName\`, \`cashAdvanceAccountName\`, \`installmentAdvanceName\`, \`sourceAccountName\`, \`sourceCashRegisterName\`, \`targetAccountName\`, \`targetCashRegisterName\`, \`fromAccountName\`, \`toAccountName\`, \`fromCashRegisterName\`, \`toCashRegisterName\`.

### İç içe ödemeler (\`payments\`)

Yalnızca \`loan\` ve \`installmentCashAdvance\` için \`payments\` dizisi kullanılabilir; uygulama bunları ayrı \`loanPayment\` / \`installmentCashAdvancePayment\` kayıtlarına genişletir.

\`creditCard\`, \`cashAdvanceAccount\` ve benzeri tiplerde **iç içe hareket dizisi yok** — her hareket ayrı \`creditCardTransaction\` veya \`cashAdvanceTransaction\` öğesi olmalı.

### Desteklenen \`type\` değerleri

| type | Zorunlu \`data\` alanları | Opsiyonel / ilişki |
|---|---|---|
| bank | name | shortName, bicSwift, branchCode, notes |
| account | name, type (\`checking\`/\`savings\`/\`fx\`/\`other\`), openingDate, bankId veya bankRef/bankName | openingBalance, iban, notes |
| cashRegister | name, openingDate | openingBalance, notes |
| incomeType / expenseType | name | color, notes |
| loan | name, bankId veya bankRef/bankName, principal, termMonths, startDate, firstInstallmentDate, interestRate, interestPeriod (\`monthly\`/\`annual\`) | disbursementAccountId, lateInterestRate, lateInterestPeriod, taxRateMonthly, notes, payments[] |
| loanPayment | loanId veya loanRef/loanName, installmentIndex, dueDate, scheduledAmount | paidDate, paidAmount, lateFee, notes, sourceAccountId/sourceAccountName, sourceCashRegisterId/sourceCashRegisterName |
| creditCard | name, bankId veya bankRef/bankName, limit, statementCutoffDay (1–28), paymentDueDay (1–28), purchaseAprMonthly | openingBalance, lateAprMonthly, cashAdvanceAprMonthly, notes |
| creditCardTransaction | cardId veya cardRef/cardName, date, type (\`purchase\`/\`payment\`/\`cashAdvance\`), amount | description, installmentCount, notes; \`payment\` → sourceAccountId/sourceAccountName, sourceCashRegisterId/sourceCashRegisterName; \`cashAdvance\` → targetAccountId/targetAccountName, targetCashRegisterId/targetCashRegisterName |
| cashAdvanceAccount | name, bankId veya bankRef/bankName, limit, openingDate, interestRate, interestPeriod | openingBalance, lateInterestRate, lateInterestPeriod, notes |
| cashAdvanceTransaction | accountId veya accountRef/cashAdvanceAccountRef/cashAdvanceAccountName, date, type (\`draw\`/\`payment\`), amount | description, notes; \`payment\` → sourceAccountId/sourceAccountName, sourceCashRegisterId/sourceCashRegisterName; \`draw\` → targetAccountId/targetAccountName, targetCashRegisterId/targetCashRegisterName |
| installmentCashAdvance | name, bankId veya bankRef/bankName, principal, termMonths, startDate, firstInstallmentDate, interestRate, interestPeriod | cashAdvanceAccountId/cashAdvanceAccountRef/cashAdvanceAccountName, taxRateMonthly, lateInterestRate, lateInterestPeriod, earlyPayoffWithoutInterest, notes, payments[] |
| installmentCashAdvancePayment | installmentAdvanceId veya installmentAdvanceRef/installmentAdvanceName, installmentIndex, dueDate, scheduledAmount | paidDate, paidAmount, lateFee, notes, sourceAccountId/sourceAccountName, sourceCashRegisterId/sourceCashRegisterName |
| income | amount, plannedDate + accountId/accountRef/accountName **veya** cashRegisterId/cashRegisterRef/cashRegisterName | incomeTypeId/incomeTypeName, actualDate, recurrence (\`daily\`/\`weekly\`/\`monthly\`/\`yearly\`), description, notes |
| expense | amount, plannedDate + accountId/accountRef/accountName **veya** cashRegisterId/cashRegisterRef/cashRegisterName | expenseTypeId/expenseTypeName, actualDate, recurrence (\`daily\`/\`weekly\`/\`monthly\`/\`yearly\`), description, notes |
| transfer | amount, date + kaynak (fromAccountId/fromAccountRef/fromAccountName veya fromCashRegisterId/fromCashRegisterRef/fromCashRegisterName) + hedef (toAccount* veya toCashRegister*) | description, notes, exchangeRate, targetAmount (farklı para birimli transfer) |

### Örnek — kredi kartı + hareketler

\`\`\`kp-proposals
{
  "version": 1,
  "items": [
    { "ref": "b1", "type": "bank", "data": { "name": "Garanti BBVA" } },
    {
      "ref": "c1",
      "type": "creditCard",
      "data": {
        "name": "Bonus Kart",
        "bankRef": "b1",
        "limit": 50000,
        "statementCutoffDay": 15,
        "paymentDueDay": 25,
        "purchaseAprMonthly": 0.0375,
        "openingBalance": 3200
      }
    },
    {
      "type": "creditCardTransaction",
      "data": {
        "cardRef": "c1",
        "date": "2025-03-10",
        "type": "purchase",
        "amount": 1250.5,
        "description": "Market"
      }
    },
    {
      "type": "creditCardTransaction",
      "data": {
        "cardName": "Bonus Kart",
        "date": "2025-03-20",
        "type": "payment",
        "amount": 3200,
        "sourceAccountName": "Vadesiz TL"
      }
    }
  ]
}
\`\`\`

### Örnek — taksitli nakit avans + banka

\`\`\`kp-proposals
{
  "version": 1,
  "items": [
    { "ref": "b1", "type": "bank", "data": { "name": "Garanti BBVA" } },
    {
      "ref": "ica1",
      "type": "installmentCashAdvance",
      "data": {
        "name": "Taksitli nakit avans",
        "bankRef": "b1",
        "principal": 25000,
        "termMonths": 12,
        "startDate": "2025-01-10",
        "firstInstallmentDate": "2025-02-10",
        "interestRate": 0.0425,
        "interestPeriod": "monthly"
      },
      "payments": [
        { "installmentIndex": 1, "dueDate": "2025-02-10", "scheduledAmount": 2145.5 }
      ]
    }
  ]
}
\`\`\`

### Örnek — mevcut karta hareket (snapshot'tan)

Snapshot'ta \`type: "creditCard"\` kaydının \`id\` alanını kullan:

\`\`\`kp-proposals
{
  "version": 1,
  "items": [
    {
      "type": "creditCardTransaction",
      "data": {
        "cardId": "<snapshot-creditCard-id>",
        "date": "2025-03-15",
        "type": "purchase",
        "amount": 890,
        "description": "Akaryakıt",
        "installmentCount": 3
      }
    }
  ]
}
\`\`\``
