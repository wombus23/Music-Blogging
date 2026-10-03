// turtles music hat: a tiny blog where posts can carry images and links to music, with text sizes.
// Run: ADMIN_PASSWORD=yourpassword node server.js
const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = process.env.PORT || 3000;
const PASSWORD = process.env.ADMIN_PASSWORD || 'changeme';
const SECRET = process.env.SESSION_SECRET || crypto.createHash('sha256').update('tmh' + PASSWORD).digest('hex');
const DATA = process.env.DATA_DIR || path.join(__dirname, 'data');
const UPLOADS = path.join(DATA, 'uploads');
const DB = path.join(DATA, 'posts.json');
const IMG = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.avif'];
const AUDIO = ['.mp3', '.wav', '.flac', '.ogg', '.oga', '.m4a', '.aac', '.opus', '.webm'];
fs.mkdirSync(UPLOADS, { recursive: true });

const load = () => { try { return JSON.parse(fs.readFileSync(DB, 'utf8')); } catch { return []; } };
const save = (posts) => fs.writeFileSync(DB, JSON.stringify(posts, null, 2));

// Example post, added only on a fresh install (when no posts file exists yet)
const EXAMPLE = {
  id: 'welcome',
  title: 'Welcome to the hat',
  date: Date.now(),
  links: [{ url: 'https://example.com', name: 'An example link' }],
  text: `Hello, and welcome to **turtles music hat**. This is a small corner of the internet for *slow music* and the people who make it.

Posts are formatted with the bar above the text box. Select some words, then press **B** for **bold**, **I** for *italic*, or pick a number from the size box, like [size=28]big[/size] or [size=13]small[/size], just like in Word.

Some ways I might use them:

**New track:** *Shell Game*, a lazy piano loop recorded on a rainy Sunday.
**Note to self:** *never* rush the intro.
The ***only*** rule here is that every song gets to take its time.

Every post can also carry links. Add one under the text box and visitors get a button to open it or copy it to share, like the one below.

*Thanks for stopping by. Take it slow.*`,
};
if (!fs.existsSync(DB)) save([EXAMPLE]);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const date = (t) => new Date(t).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

// Signed cookie session
const sign = (v) => v + '.' + crypto.createHmac('sha256', SECRET).update(v).digest('hex');
const authed = (req) => {
  const m = /(?:^|; )sid=([^;]+)/.exec(req.headers.cookie || '');
  if (!m) return false;
  const i = m[1].lastIndexOf('.');
  const good = Buffer.from(sign(m[1].slice(0, i)));
  const got = Buffer.from(m[1]);
  return good.length === got.length && crypto.timingSafeEqual(good, got) && Date.now() - Number(m[1].slice(0, i)) < 7 * 864e5;
};
const need = (req, res, next) => (authed(req) ? next() : res.redirect('/admin'));

// Image uploads: jpg, png, gif, webp, avif (up to 15 MB each, 12 per post)
const upload = multer({
  storage: multer.diskStorage({
    destination: UPLOADS,
    filename: (req, file, cb) => cb(null, crypto.randomBytes(6).toString('hex') + path.extname(file.originalname).toLowerCase()),
  }),
  limits: { fileSize: 15 * 1024 * 1024, files: 12 },
  fileFilter: (req, file, cb) => cb(null, IMG.includes(path.extname(file.originalname).toLowerCase()) && file.mimetype.startsWith('image/')),
}).array('images', 12);

// [size=24]text[/size], ***bold italic***, **bold** and *italic*
const fmt = (t) =>
  t
    .replace(/\[size=(\d{1,3})\]([\s\S]*?)\[\/size\]/g, (m, n, x) => `<span style="font-size:${Math.min(72, Math.max(8, +n))}px">${x}</span>`)
    .replace(/\*\*\*(\S(?:.*?\S)?)\*\*\*/g, '<strong><em>$1</em></strong>')
    .replace(/\*\*(\S(?:.*?\S)?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(\S(?:.*?\S)?)\*/g, '<em>$1</em>');
const body = (text) =>
  esc(text)
    .replace(/\r\n?/g, '\n')
    .split(/\n{2,}/)
    .map((p) => '<p>' + fmt(p).replace(/\n/g, '<br>').replace(/(https?:\/\/[^\s<]*[^\s<.,;:!?)])/g, '<a href="$1">$1</a>') + '</p>')
    .join('');

const CSS = `
:root{color-scheme:light dark;--bg:#f2f5f0;--ink:#1d2b25;--soft:#5d6d65;--moss:#3f6b50;--shell:#c8963e;--line:#d9e0d8;--font:ui-rounded,"SF Pro Rounded","Nunito","Segoe UI",system-ui,sans-serif}
@media (prefers-color-scheme:dark){:root{--bg:#141c18;--ink:#e6ede8;--soft:#9aaba1;--moss:#7db592;--shell:#d9aa55;--line:#27342d}}
*{box-sizing:border-box}
html{-webkit-text-size-adjust:100%;font-size:100%}
body{margin:0;background:var(--bg);color:var(--ink);font:1.0625rem/1.65 var(--font);overflow-wrap:anywhere}
main{max-width:600px;margin:0 auto;padding:32px max(18px,env(safe-area-inset-right)) 64px max(18px,env(safe-area-inset-left))}
header{display:flex;align-items:center;flex-wrap:wrap;gap:12px 14px;margin-bottom:44px}
header a{color:var(--ink);text-decoration:none;display:flex;align-items:center;gap:12px;min-width:0}
header svg{flex:none}
h1{font-size:clamp(1.375rem,7vw,1.875rem);line-height:1.1;margin:0;font-weight:700;letter-spacing:-.02em}
h2{font-size:clamp(1.3125rem,5.6vw,1.5rem);line-height:1.25;margin:0 0 4px;letter-spacing:-.01em}
h2 a{color:var(--ink);text-decoration:none}h2 a:hover{color:var(--moss)}
a{color:var(--moss)}
strong,b{font-weight:800}
em,i{font-style:italic}
.meta{color:var(--soft);font-size:0.875rem;margin:0 0 14px}
article{padding:0 0 32px;margin:0 0 32px;border-bottom:1px solid var(--line)}
article:last-of-type{border:0}
p{margin:0 0 14px}
.track{margin:16px 0;padding:14px 16px;border:1px solid var(--line);border-radius:14px}
.track b{display:block;font-size:0.9375rem;margin-bottom:8px}
audio{width:100%;height:44px}
.pic{display:block;margin:18px 0}
.pic img,.lkimg{display:block;max-width:100%;height:auto;border-radius:12px}
.lkimg{margin-top:4px}
.acts{display:flex;flex-wrap:wrap;gap:8px;margin-top:10px}
button,.btn{font:inherit;font-size:0.875rem;color:var(--moss);background:none;border:1px solid var(--line);border-radius:999px;padding:8px 14px;min-height:40px;cursor:pointer;text-decoration:none;display:inline-flex;align-items:center}
.acts a{color:var(--moss);font-size:0.875rem;border:1px solid var(--line);border-radius:999px;padding:8px 14px;min-height:40px;text-decoration:none;display:inline-flex;align-items:center}
button:focus-visible,a:focus-visible,input:focus-visible,textarea:focus-visible{outline:2px solid var(--shell);outline-offset:2px}
form.box{display:grid;gap:14px}
input,textarea{font:inherit;font-size:max(16px,1rem);width:100%;padding:12px;border:1px solid var(--line);border-radius:10px;background:transparent;color:var(--ink)}
textarea{min-height:180px;resize:vertical}
label{font-size:0.875rem;color:var(--soft);display:grid;gap:6px}
.go{font:inherit;font-size:1rem;font-weight:600;background:var(--moss);color:var(--bg);border:0;border-radius:12px;padding:12px 20px;min-height:46px;justify-self:start;justify-content:center}
.row{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:6px 0;border-bottom:1px solid var(--line)}
.row a{padding:8px 0}
.fld{display:grid;gap:6px;font-size:.875rem;color:var(--soft)}
.bar{display:flex;flex-wrap:wrap;gap:8px;align-items:center}
.bar button{min-width:44px;justify-content:center;font-size:1rem;color:var(--ink)}
select{font:inherit;font-size:max(16px,1rem);color:var(--ink);background:var(--bg);border:1px solid var(--line);border-radius:999px;padding:8px 14px;min-height:40px}
select:focus-visible{outline:2px solid var(--shell);outline-offset:2px}
.lk{display:grid;gap:8px;margin-bottom:8px}
@media (min-width:600px){.lk{grid-template-columns:1fr 2fr}}
#addlink{justify-self:start}
.err{color:#b3402f}
.mascot{display:block;width:min(150px,45vw);height:auto;margin:0 auto 40px}
@media (min-width:1200px){.mascot{position:fixed;right:4vw;bottom:0;width:250px;margin:0}}
@media (max-width:600px){
body{font-size:1rem}
header{margin-bottom:32px}
header svg{width:52px;height:auto}
.track{padding:12px}
.go{width:100%;justify-self:stretch}
}
`;

const LOGO = `<svg width="64" height="40" viewBox="0 0 64 40" role="img" aria-label="Turtle wearing a top hat">
<rect x="14" y="31" width="8" height="6" rx="3" fill="var(--moss)"/><rect x="38" y="31" width="8" height="6" rx="3" fill="var(--moss)"/>
<circle cx="55" cy="27" r="6" fill="var(--moss)"/><circle cx="57" cy="26" r="1.2" fill="var(--bg)"/>
<path d="M6 32A24 20 0 0 1 54 32Z" fill="var(--moss)"/>
<rect x="23" y="3" width="14" height="10" rx="1.5" fill="var(--ink)"/><rect x="23" y="9" width="14" height="2.5" fill="var(--shell)"/>
<rect x="19" y="12.5" width="22" height="3" rx="1.5" fill="var(--ink)"/></svg>`;

const page = (title, inner) => `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="theme-color" content="#f2f5f0" media="(prefers-color-scheme: light)"><meta name="theme-color" content="#141c18" media="(prefers-color-scheme: dark)">
<title>${esc(title)}</title>
<link rel="icon" href="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>🐢</text></svg>">
<style>${CSS}</style></head><body>
<main>
<header><a href="/">${LOGO}<h1>turtles music hat</h1></a></header>
${inner}
</main>
<img class="mascot" src="/img/turtle.png" alt="A turtle singing on a rock" width="250">
<script>
document.addEventListener('click',function(e){var b=e.target.closest('[data-copy]');if(!b)return;
var u=new URL(b.dataset.copy,location.origin).href,t=b.textContent;
(navigator.clipboard?navigator.clipboard.writeText(u):Promise.reject()).catch(function(){prompt('Copy this link',u)});
b.textContent='Copied';setTimeout(function(){b.textContent=t},1500)});
</script>
</body></html>`;

const fileTracks = (p) =>
  (p.files || [])
    .map(
      (f) => `<div class="track"><b>${esc(f.name)}</b>
<audio controls preload="none" src="/files/${f.file}"></audio>
<div class="acts"><button data-copy="/files/${f.file}">Copy file link</button><a href="/files/${f.file}" download="${esc(f.name)}">Download</a></div></div>`
    )
    .join('');

const linkCards = (p) =>
  (p.links || [])
    .map((l) => {
      const u = new URL(l.url);
      const host = u.hostname.replace(/^www\./, '');
      const ext = (e) => u.pathname.toLowerCase().endsWith(e);
      const isImg = IMG.some(ext);
      const direct = AUDIO.some(ext);
      return `<div class="track"><b>${esc(l.name || host)}</b>
${isImg ? `<img class="lkimg" src="${esc(l.url)}" alt="" loading="lazy" referrerpolicy="no-referrer">` : direct ? `<audio controls preload="none" src="${esc(l.url)}"></audio>` : `<p class="meta" style="margin:0">${esc(host)}</p>`}
<div class="acts"><a href="${esc(l.url)}" target="_blank" rel="noopener noreferrer">Open link</a><button data-copy="${esc(l.url)}">Copy link</button></div></div>`;
    })
    .join('');
const images = (p) =>
  (p.images || [])
    .map((f) => `<a class="pic" href="/files/${f.file}" target="_blank" rel="noopener"><img src="/files/${f.file}" alt="${esc(f.name.replace(/\.[^.]+$/, ''))}" loading="lazy"></a>`)
    .join('');
const tracks = (p) => images(p) + fileTracks(p) + linkCards(p);

// Toolbar and link rows on the write page (String.raw keeps the backslashes)
const EDITOR_JS = String.raw`(function(){
var t=document.getElementById('txt'),sz=document.getElementById('sz');
function wrap(open,close){
  var a=t.selectionStart,b=t.selectionEnd,v=t.value,sel=v.slice(a,b),out,caret;
  if(!sel){out=open+close;caret=a+open.length}
  else{out=sel.split(/(\n{2,})/).map(function(p){return /\S/.test(p)?p.replace(/^(\s*)([\s\S]*?)(\s*)$/,function(m,l,c,r){return l+open+c+close+r}):p}).join('');caret=a+out.length}
  t.value=v.slice(0,a)+out+v.slice(b);t.focus();t.setSelectionRange(caret,caret);
}
document.querySelectorAll('[data-wrap]').forEach(function(btn){
  btn.addEventListener('mousedown',function(e){e.preventDefault()});
  btn.addEventListener('click',function(){var w=btn.dataset.wrap;wrap(w,w)});
});
sz.addEventListener('change',function(){if(sz.value){wrap('[size='+sz.value+']','[/size]');sz.value=''}});
document.getElementById('addlink').addEventListener('click',function(){
  var box=document.getElementById('links'),row=box.firstElementChild.cloneNode(true);
  row.querySelectorAll('input').forEach(function(i){i.value=''});box.appendChild(row);row.querySelector('input').focus();
});
})();`;

const SIZE_OPTIONS = [10, 12, 14, 16, 18, 20, 24, 28, 32, 40, 48].map((n) => `<option>${n}</option>`).join('');

const app = express();
app.set('trust proxy', 1);
app.use(express.urlencoded({ extended: false }));
app.use('/img', express.static(path.join(__dirname, 'public')));
app.use('/files', express.static(UPLOADS, { setHeaders: (res) => res.set('X-Content-Type-Options', 'nosniff') }));

app.get('/', (req, res) => {
  const posts = load();
  const list = posts.length
    ? posts
        .map(
          (p) => `<article><h2><a href="/post/${p.id}">${esc(p.title)}</a></h2><p class="meta">${date(p.date)}</p>
${body(p.text || '')}${tracks(p)}</article>`
        )
        .join('')
    : '<p>No posts yet.</p>';
  res.send(page('turtles music hat', list));
});

app.get('/post/:id', (req, res) => {
  const p = load().find((x) => x.id === req.params.id);
  if (!p) return res.status(404).send(page('Not found', '<p>That post does not exist.</p><p><a href="/">Back home</a></p>'));
  res.send(
    page(
      p.title + ' | turtles music hat',
      `<article><h2>${esc(p.title)}</h2><p class="meta">${date(p.date)}</p>${body(p.text || '')}${tracks(p)}
<div class="acts"><button data-copy="/post/${p.id}">Copy post link</button></div></article>`
    )
  );
});

app.get('/admin', (req, res) => {
  if (!authed(req)) {
    return res.send(
      page(
        'Log in',
        `<form class="box" method="post" action="/admin/login"><label>Password<input type="password" name="password" autofocus required></label>
${req.query.error ? '<p class="err">Wrong password. Try again.</p>' : ''}<button class="go">Log in</button></form>`
      )
    );
  }
  const posts = load();
  res.send(
    page(
      'Write',
      `<form class="box" method="post" action="/admin/post" enctype="multipart/form-data">
<label>Title<input name="title" required></label>
<div class="fld"><span>Text</span>
<div class="bar"><button type="button" data-wrap="**" aria-label="Bold" title="Bold"><b>B</b></button><button type="button" data-wrap="*" aria-label="Italic" title="Italic"><i>I</i></button><select id="sz" aria-label="Font size"><option value="">Size</option>${SIZE_OPTIONS}</select></div>
<textarea id="txt" name="text"></textarea></div>
<label>Images (jpg, png, gif, webp)<input type="file" name="images" accept="image/*" multiple></label>
<div class="fld"><span>Links</span>
<div id="links"><div class="lk"><input name="linkTitle" placeholder="Name (optional)" autocomplete="off"><input name="linkUrl" placeholder="Paste a link" inputmode="url" autocapitalize="off" autocomplete="off"></div></div>
<button type="button" id="addlink">+ Add another link</button></div>
<button class="go">Publish</button></form>
<script>${EDITOR_JS}</script>
<h2 style="margin-top:48px">Your posts</h2>
${posts
  .map(
    (p) => `<div class="row"><a href="/post/${p.id}">${esc(p.title)}</a>
<form method="post" action="/admin/delete/${p.id}" onsubmit="return confirm('Delete this post?')"><button>Delete</button></form></div>`
  )
  .join('') || '<p>Nothing published yet.</p>'}
${posts.some((p) => p.id === 'welcome') ? '' : '<form method="post" action="/admin/example" style="margin-top:20px"><button>Add the example post</button></form>'}
<form method="post" action="/admin/logout" style="margin-top:24px"><button>Log out</button></form>`
    )
  );
});

app.post('/admin/login', (req, res) => {
  const a = Buffer.from(String(req.body.password || ''));
  const b = Buffer.from(PASSWORD);
  const ok = a.length === b.length && crypto.timingSafeEqual(a, b);
  setTimeout(() => {
    if (!ok) return res.redirect('/admin?error=1');
    const secure = req.secure ? '; Secure' : '';
    res.setHeader('Set-Cookie', `sid=${sign(String(Date.now()))}; HttpOnly; SameSite=Lax; Path=/; Max-Age=604800${secure}`);
    res.redirect('/admin');
  }, ok ? 0 : 800);
});

app.post('/admin/logout', (req, res) => {
  res.setHeader('Set-Cookie', 'sid=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0');
  res.redirect('/');
});

const list = (v) => [].concat(v || []);
const cleanUrl = (raw) => {
  let u = String(raw || '').trim();
  if (!u) return null;
  if (!/^[a-z][a-z0-9+.-]*:/i.test(u)) u = 'https://' + u;
  try { const x = new URL(u); return /^https?:$/.test(x.protocol) ? x.href : null; } catch { return null; }
};

app.post('/admin/post', need, (req, res) => {
  upload(req, res, (err) => {
    if (err) return res.status(400).send(page('Upload failed', `<p class="err">${esc(err.message)}</p><p><a href="/admin">Back</a></p>`));
    const names = list(req.body.linkTitle);
    const links = list(req.body.linkUrl)
      .map((u, i) => ({ url: cleanUrl(u), name: String(names[i] || '').trim() }))
      .filter((l) => l.url);
    const posts = load();
    const id = crypto.randomBytes(4).toString('hex');
    posts.unshift({
      id,
      title: String(req.body.title || 'Untitled').trim() || 'Untitled',
      text: String(req.body.text || '').trim(),
      date: Date.now(),
      images: (req.files || []).map((f) => ({ file: f.filename, name: f.originalname })),
      links,
    });
    save(posts);
    res.redirect('/post/' + id);
  });
});

app.post('/admin/example', need, (req, res) => {
  const posts = load();
  if (!posts.some((p) => p.id === EXAMPLE.id)) save([{ ...EXAMPLE, date: Date.now() }, ...posts]);
  res.redirect('/post/' + EXAMPLE.id);
});

app.post('/admin/delete/:id', need, (req, res) => {
  const posts = load();
  const p = posts.find((x) => x.id === req.params.id);
  if (p) {
    [...(p.files || []), ...(p.images || [])].forEach((f) => fs.rm(path.join(UPLOADS, f.file), () => {}));
    save(posts.filter((x) => x !== p));
  }
  res.redirect('/admin');
});

app.listen(PORT, () => {
  console.log('turtles music hat (images, links and text sizes on) is running on http://localhost:' + PORT);
  if (PASSWORD === 'changeme') console.log('Warning: set ADMIN_PASSWORD before you put this online.');
});