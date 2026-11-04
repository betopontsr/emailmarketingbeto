# Fixtures da Perfect Pay

Os arquivos `hipotetico-*.json` seguem o formato público conhecido do postback da Perfect Pay,
mas **não são payloads reais deste funil**. Quando você colar payloads reais, salve-os aqui como
`real-*.json` (sem dados de cartão), ajuste `src/lib/perfectpay/adapter.ts` e os testes em
`tests/perfectpay-adapter.test.ts`.
