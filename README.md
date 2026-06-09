# Henrique Siqueira — Blog

Blog editorial moderno com Firebase + Cloudinary + Vercel.

## Estrutura de arquivos

```
henrique-siqueira/
├── index.html              ← Página principal (home)
├── artigo.html             ← Template de artigo (dinâmico via ?id=)
├── sitemap.xml             ← SEO sitemap
├── robots.txt              ← SEO + permissões para IAs
├── vercel.json             ← Config de deploy + headers de segurança
├── admin/
│   ├── login.html          ← Página de login admin
│   └── dashboard.html      ← Dashboard (criar/editar/excluir artigos)
├── css/
│   ├── style.css           ← Estilo global
│   ├── article.css         ← Estilo da página de artigo
│   └── admin.css           ← Estilo do painel admin
├── js/
│   ├── firebase-config.js  ← ⚠️ Configure suas credenciais aqui
│   ├── main.js             ← Lógica da home
│   ├── article.js          ← Lógica da página de artigo
│   ├── login.js            ← Lógica de login
│   └── dashboard.js        ← Lógica do dashboard admin
└── images/
    └── henrique.jpg        ← ⚠️ Adicione sua foto aqui
```

---

## Setup — Passo a passo

### 1. Firebase

1. Acesse [console.firebase.google.com](https://console.firebase.google.com)
2. Crie um projeto
3. Ative **Authentication → E-mail/senha**
4. Em Authentication → Users, crie seu usuário (email + senha)
5. Ative **Firestore Database** no modo produção
6. Crie a coleção `articles` (será criada automaticamente ao publicar o 1º artigo)
7. Vá em **Configurações do Projeto → Seus apps → Web** e copie as credenciais

**Regras do Firestore** (cole em Firestore → Rules):
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Artigos: leitura pública (só publicados), escrita só logado
    match /articles/{articleId} {
      allow read: if true;
      allow write: if request.auth != null;
    }
    // Mensagens: visitantes podem criar, só admin lê/apaga
    match /messages/{msgId} {
      allow create: if true;
      allow read, update, delete: if request.auth != null;
    }
    // Configurações do site: só admin
    match /settings/{docId} {
      allow read: if true;
      allow write: if request.auth != null;
    }
  }
}
```

### 2. Cloudinary

1. Crie conta em [cloudinary.com](https://cloudinary.com)
2. No Dashboard, copie seu **Cloud Name**
3. Vá em **Settings → Upload → Upload Presets**
4. Crie um preset do tipo **Unsigned** e copie o nome

### 3. Configure js/firebase-config.js

Substitua todos os valores `"SEU_..."` com os dados reais:

```js
const firebaseConfig = {
  apiKey:            "SUA_API_KEY_REAL",
  authDomain:        "seu-projeto.firebaseapp.com",
  projectId:         "seu-projeto",
  storageBucket:     "seu-projeto.appspot.com",
  messagingSenderId: "123456789",
  appId:             "1:123456789:web:abcdef",
};

export const CLOUDINARY_CLOUD_NAME    = "seu-cloud-name";
export const CLOUDINARY_UPLOAD_PRESET = "seu-preset-unsigned";
```

### 4. Foto do perfil

Coloque sua foto em `images/henrique.jpg`.
Dimensão ideal: 840×1040px ou maior, orientação retrato.

### 5. Deploy no Vercel

1. Suba o projeto no GitHub
2. Acesse [vercel.com](https://vercel.com), conecte o repositório
3. O deploy é automático — sem configuração de build necessária
4. Configure seu domínio personalizado se quiser

### 6. Sitemap

Após o deploy, atualize a URL real em `sitemap.xml` e `robots.txt`.

---

## Uso do painel admin

- Acesse: `https://seu-dominio.vercel.app/admin/login.html`
- Faça login com o e-mail/senha criados no Firebase Auth
- Crie, edite e exclua artigos pelo dashboard
- Artigos publicados aparecem automaticamente na home

---

## SEO & IAs

O site já vem configurado com:
- Meta tags completas (title, description, keywords, author)
- Open Graph (Facebook, LinkedIn, WhatsApp)
- Twitter Cards
- JSON-LD Schema.org (Blog + BlogPosting dinâmico)
- Canonical URLs
- `robots.txt` permitindo rastreamento por GPTBot, ClaudeBot, PerplexityBot, Google-Extended
- `sitemap.xml`
- Headers de segurança via `vercel.json`
