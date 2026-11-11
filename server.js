const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const SECRET = process.env.JWT_SECRET || 'CHANGE_THIS_SECRET_BEFORE_DEPLOYING';
const DB_FILE = path.join(__dirname, 'data.json');
const COMMISSION_RATE = Math.max(0, Math.min(50, Number(process.env.PLATFORM_COMMISSION_PERCENT || 10))) / 100;
app.use(cors());
app.use(express.json({limit:'2mb'}));
app.use('/uploads', express.static(path.join(__dirname,'uploads')));
app.use(express.static(path.join(__dirname,'public')));

const starterProducts = [
 {id:1,name:'Modern 3-Seater Sofa',category:'Living Room',price:1250000,oldPrice:1450000,description:'Comfortable modern sofa for your living room.',image:'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=900',stock:8,rating:4.8,approved:true,seller:'FurniMarket Store',sellerEmail:'store@furnimarket.ug'},
 {id:2,name:'Minimalist Coffee Table',category:'Living Room',price:320000,oldPrice:390000,description:'Clean wooden coffee table with a modern finish.',image:'https://images.unsplash.com/photo-1499933374294-4584851497cc?w=900',stock:15,rating:4.6,approved:true,seller:'FurniMarket Store',sellerEmail:'store@furnimarket.ug'},
 {id:3,name:'Queen Size Wooden Bed',category:'Bedroom',price:980000,oldPrice:0,description:'Strong queen-size bed frame with a timeless design.',image:'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?w=900',stock:5,rating:4.9,approved:true,seller:'FurniMarket Store',sellerEmail:'store@furnimarket.ug'},
 {id:4,name:'Ergonomic Office Chair',category:'Office',price:450000,oldPrice:520000,description:'Supportive chair for work and study.',image:'https://images.unsplash.com/photo-1505843490701-5be5d0b6f2d5?w=900',stock:12,rating:4.5,approved:true,seller:'FurniMarket Store',sellerEmail:'store@furnimarket.ug'},
 {id:5,name:'Six-Seater Dining Set',category:'Dining',price:1850000,oldPrice:0,description:'Dining table and six matching chairs.',image:'https://images.unsplash.com/photo-1615066390971-03e4e1c36ddf?w=900',stock:4,rating:4.7,approved:true,seller:'FurniMarket Store',sellerEmail:'store@furnimarket.ug'},
 {id:6,name:'Two-Door Wardrobe',category:'Bedroom',price:760000,oldPrice:850000,description:'Practical wardrobe with generous storage.',image:'https://images.unsplash.com/photo-1558997519-83ea9252edf8?w=900',stock:7,rating:4.4,approved:true,seller:'FurniMarket Store',sellerEmail:'store@furnimarket.ug'}
];
function loadDB(){if(fs.existsSync(DB_FILE)){try{return JSON.parse(fs.readFileSync(DB_FILE,'utf8'));}catch{}}
 return {users:[],products:starterProducts,orders:[],payments:[],nextUserId:1,nextProductId:7,nextOrderId:1};}
let db=loadDB();
for(const k of ['users','products','orders','payments']) if(!Array.isArray(db[k])) db[k]=[];
db.nextUserId ||= 1; db.nextProductId ||= Math.max(0,...db.products.map(p=>p.id||0))+1; db.nextOrderId ||= Math.max(0,...db.orders.map(o=>o.id||0))+1;
function saveDB(){fs.writeFileSync(DB_FILE,JSON.stringify(db,null,2));}
function tokenFor(u){return jwt.sign({id:u.id,role:u.role,email:u.email},SECRET,{expiresIn:'7d'});}
function auth(req,res,next){const h=req.headers.authorization||'';try{if(!h.startsWith('Bearer '))throw 0;req.user=jwt.verify(h.slice(7),SECRET);next();}catch{return res.status(401).json({error:'Please sign in to continue.'});}}
function role(...roles){return(req,res,next)=>roles.includes(req.user.role)?next():res.status(403).json({error:'You do not have permission for this action.'});}
function publicUser(u){return{id:u.id,name:u.name,email:u.email,role:u.role};}
async function ensureAdmin(){const email=(process.env.ADMIN_EMAIL||'admin@furnimarket.ug').toLowerCase();if(!db.users.some(u=>u.email===email)){const password=process.env.ADMIN_PASSWORD||'ChangeMe123!';db.users.push({id:db.nextUserId++,name:'Administrator',email,password:await bcrypt.hash(password,10),role:'admin'});saveDB();console.log('Admin created:',email,'— change credentials before launch.');}}
ensureAdmin();
const storage=multer.diskStorage({destination:(req,file,cb)=>cb(null,path.join(__dirname,'uploads')),filename:(req,file,cb)=>{const ext=path.extname(file.originalname).toLowerCase();cb(null,Date.now()+'-'+crypto.randomBytes(6).toString('hex')+ext);}});
const upload=multer({storage,limits:{fileSize:5*1024*1024},fileFilter:(req,file,cb)=>{if(!['image/jpeg','image/png','image/webp','image/gif'].includes(file.mimetype))return cb(new Error('Only JPG, PNG, WEBP or GIF images are allowed.'));cb(null,true);}});

app.get('/api/health',(req,res)=>res.json({service:'FurniMarket',status:'online',version:'1.1.0'}));
app.get('/api/categories',(req,res)=>res.json(['Living Room','Bedroom','Dining','Office','Kitchen','Outdoor','Decorations','Storage']));
app.get('/api/products',(req,res)=>{let a=db.products.filter(p=>p.approved);const q=String(req.query.q||'').toLowerCase(),c=String(req.query.category||'');if(q)a=a.filter(p=>(p.name+' '+p.description+' '+p.category).toLowerCase().includes(q));if(c&&c!=='All')a=a.filter(p=>p.category===c);res.json(a);});
app.get('/api/products/:id',(req,res)=>{const p=db.products.find(x=>x.id===+req.params.id&&x.approved);p?res.json(p):res.status(404).json({error:'Product not found'});});
app.post('/api/auth/register',async(req,res)=>{const{name,email,password}=req.body||{};if(!name||!email||!password||password.length<8)return res.status(400).json({error:'Enter name, email and a password of at least 8 characters.'});const e=String(email).trim().toLowerCase();if(db.users.some(u=>u.email===e))return res.status(409).json({error:'An account with this email already exists.'});const u={id:db.nextUserId++,name:String(name).trim(),email:e,password:await bcrypt.hash(password,10),role:'customer'};db.users.push(u);saveDB();res.status(201).json({token:tokenFor(u),user:publicUser(u)});});
app.post('/api/auth/login',async(req,res)=>{const{email,password}=req.body||{};const u=db.users.find(x=>x.email===String(email||'').trim().toLowerCase());if(!u||!await bcrypt.compare(password||'',u.password))return res.status(401).json({error:'Email or password is incorrect.'});res.json({token:tokenFor(u),user:publicUser(u)});});
app.get('/api/me',auth,(req,res)=>{const u=db.users.find(x=>x.id===req.user.id);u?res.json(publicUser(u)):res.status(404).json({error:'Account not found'});});
app.post('/api/seller/apply',auth,(req,res)=>{
 const u=db.users.find(x=>x.id===req.user.id);
 if(u.role!=='admin')u.role='seller';
 saveDB();
 const newToken=tokenFor(u);
 res.json({
  message:'Seller access enabled.',
  user:publicUser(u),
  token:newToken
 });
});
app.post('/api/uploads/product-image',auth,role('seller','admin'),(req,res)=>upload.single('image')(req,res,err=>{if(err)return res.status(400).json({error:err.message});if(!req.file)return res.status(400).json({error:'Choose an image file.'});res.status(201).json({url:'/uploads/'+req.file.filename});}));
app.post('/api/seller/products',auth,role('seller','admin'),(req,res)=>{const{name,category,price,description,image,stock}=req.body||{};if(!name||!category||!Number.isFinite(Number(price))||Number(price)<=0)return res.status(400).json({error:'Product name, category and valid price are required.'});const u=db.users.find(x=>x.id===req.user.id);const p={id:db.nextProductId++,name:String(name),category:String(category),price:Number(price),oldPrice:0,description:String(description||''),image:String(image||''),stock:Math.max(0,Number(stock)||0),rating:0,approved:req.user.role==='admin',seller:u.name,sellerEmail:u.email};db.products.push(p);saveDB();res.status(201).json({message:p.approved?'Product published.':'Product submitted for admin approval.',product:p});});
app.get('/api/seller/products',auth,role('seller','admin'),(req,res)=>res.json(db.products.filter(p=>req.user.role==='admin'||p.sellerEmail===req.user.email)));
app.get('/api/seller/summary',auth,role('seller','admin'),(req,res)=>{const own=db.orders.filter(o=>o.paymentStatus==='Paid'||o.paymentMethod==='Cash on delivery').flatMap(o=>o.sellerBreakdown||[]).filter(x=>x.sellerEmail===req.user.email);res.json({products:db.products.filter(p=>p.sellerEmail===req.user.email).length,orders:own.length,gross:own.reduce((s,x)=>s+x.gross,0),commission:own.reduce((s,x)=>s+x.commission,0),net:own.reduce((s,x)=>s+x.net,0)});});

function makeOrder(req,body,paymentMethod){const{items,customerName,phone,address,deliveryNotes}=body||{};if(!Array.isArray(items)||!items.length||!customerName||!phone||!address)throw new Error('Cart, customer name, phone and delivery address are required.');let total=0;const orderItems=[];for(const item of items){const p=db.products.find(x=>x.id===Number(item.id)&&x.approved);const qty=Math.max(1,Math.min(50,Number(item.quantity)||1));if(!p||p.stock<qty)throw new Error(p?p.name+' has insufficient stock.':'A product is unavailable.');total+=p.price*qty;orderItems.push({productId:p.id,name:p.name,price:p.price,quantity:qty,seller:p.seller||'FurniMarket Store',sellerEmail:p.sellerEmail||''});}
 const grouped={};for(const i of orderItems){const k=i.sellerEmail||'store@furnimarket.ug';grouped[k] ||= {seller:i.seller,sellerEmail:k,gross:0};grouped[k].gross+=i.price*i.quantity;}
 const sellerBreakdown=Object.values(grouped).map(x=>({...x,commission:Math.round(x.gross*COMMISSION_RATE),net:x.gross-Math.round(x.gross*COMMISSION_RATE)}));
 const o={id:db.nextOrderId++,userId:req.user.id,items:orderItems,total,customerName:String(customerName),phone:String(phone),address:String(address),deliveryNotes:String(deliveryNotes||''),paymentMethod,paymentStatus:paymentMethod==='Cash on delivery'?'Pay on delivery':'Pending',status:'Received',sellerBreakdown,commissionRate:COMMISSION_RATE,createdAt:new Date().toISOString()};return o;}
app.post('/api/orders',auth,(req,res)=>{try{const o=makeOrder(req,req.body,'Cash on delivery');o.items.forEach(i=>{const p=db.products.find(x=>x.id===i.productId);p.stock-=i.quantity;});db.orders.push(o);saveDB();res.status(201).json({message:'Order received. The store will contact you to confirm delivery.',order:o});}catch(e){res.status(400).json({error:e.message});}});
app.get('/api/orders/mine',auth,(req,res)=>res.json(db.orders.filter(o=>o.userId===req.user.id).reverse()));

// Flutterwave Uganda collection supports both MTN and Airtel mobile money.
app.post('/api/payments/mobile-money',auth,async(req,res)=>{try{if(!process.env.FLW_SECRET_KEY)return res.status(503).json({error:'Mobile Money is not configured yet. Add FLW_SECRET_KEY to your private .env file.'});const{network,phoneNumber,customerName,email}=req.body||{};if(!['MTN','AIRTEL'].includes(network))return res.status(400).json({error:'Choose MTN or AIRTEL.'});if(!phoneNumber||!email)return res.status(400).json({error:'Phone number and email are required.'});const order=makeOrder(req,req.body,'Mobile Money ('+network+')');order.status='Awaiting payment';db.orders.push(order);const txRef='FM-'+order.id+'-'+crypto.randomBytes(8).toString('hex');const payload={phone_number:String(phoneNumber).replace(/\s/g,''),network,amount:order.total,currency:'UGX',email:String(email),fullname:String(customerName||order.customerName),tx_ref:txRef,redirect_url:process.env.FLW_REDIRECT_URL||undefined,meta:{order_id:order.id,user_id:req.user.id}};const response=await fetch('https://api.flutterwave.com/v3/charges?type=mobile_money_uganda',{method:'POST',headers:{Authorization:'Bearer '+process.env.FLW_SECRET_KEY,'Content-Type':'application/json'},body:JSON.stringify(payload)});const data=await response.json();if(!response.ok||data.status!=='success'){db.orders=db.orders.filter(x=>x.id!==order.id);saveDB();return res.status(502).json({error:data.message||'Payment request could not be started.'});}const pay={txRef,orderId:order.id,userId:req.user.id,network,phoneNumber,status:'pending',createdAt:new Date().toISOString(),flwId:data.data?.id||null,redirect:data.meta?.authorization?.redirect||null};db.payments.push(pay);saveDB();res.status(201).json({message:'Payment request started. Approve the prompt on your phone.',txRef,redirect:pay.redirect,orderId:order.id});}catch(e){res.status(400).json({error:e.message});}});
async function verifyFlutterwave(txRef){const p=db.payments.find(x=>x.txRef===txRef);if(!p)throw new Error('Payment reference not found.');if(!process.env.FLW_SECRET_KEY)throw new Error('Payment gateway is not configured.');const url=p.flwId?'https://api.flutterwave.com/v3/transactions/'+p.flwId+'/verify':'https://api.flutterwave.com/v3/transactions/verify_by_reference?tx_ref='+encodeURIComponent(txRef);const r=await fetch(url,{headers:{Authorization:'Bearer '+process.env.FLW_SECRET_KEY}});const d=await r.json();if(!r.ok||d.status!=='success')throw new Error(d.message||'Could not verify payment.');const x=d.data;if(x.status==='successful'&&x.currency==='UGX'&&Number(x.amount)>=Number(db.orders.find(o=>o.id===p.orderId)?.total)){p.status='successful';const o=db.orders.find(o=>o.id===p.orderId);if(o&&o.paymentStatus!=='Paid'){o.paymentStatus='Paid';o.status='Confirmed';o.items.forEach(i=>{const product=db.products.find(v=>v.id===i.productId);if(product)product.stock=Math.max(0,product.stock-i.quantity);});}}else if(['failed','cancelled'].includes(x.status)){p.status=x.status;const o=db.orders.find(o=>o.id===p.orderId);if(o)o.status='Payment '+x.status;}p.verifiedAt=new Date().toISOString();saveDB();return{payment:p,order:db.orders.find(o=>o.id===p.orderId)};}
app.get('/api/payments/verify/:txRef',auth,async(req,res)=>{try{const p=db.payments.find(x=>x.txRef===req.params.txRef&&x.userId===req.user.id);if(!p)return res.status(404).json({error:'Payment not found.'});const result=await verifyFlutterwave(req.params.txRef);res.json(result);}catch(e){res.status(400).json({error:e.message});}});
app.post('/api/payments/flutterwave-webhook',async(req,res)=>{const signature=req.headers['verif-hash'];if(!process.env.FLW_SECRET_HASH||!signature||signature!==process.env.FLW_SECRET_HASH)return res.sendStatus(401);try{const txRef=req.body?.data?.tx_ref;if(txRef)await verifyFlutterwave(txRef);res.sendStatus(200);}catch(e){console.error('Webhook verification error:',e.message);res.sendStatus(500);}});

app.get('/api/admin/summary',auth,role('admin'),(req,res)=>res.json({customers:db.users.filter(u=>u.role==='customer').length,sellers:db.users.filter(u=>u.role==='seller').length,products:db.products.length,pendingProducts:db.products.filter(p=>!p.approved).length,orders:db.orders.length,paidRevenue:db.orders.filter(o=>o.paymentStatus==='Paid').reduce((s,o)=>s+o.total,0),commissions:db.orders.filter(o=>o.paymentStatus==='Paid'||o.paymentMethod==='Cash on delivery').reduce((s,o)=>s+(o.sellerBreakdown||[]).reduce((a,x)=>a+x.commission,0),0)}));
app.get('/api/admin/products',auth,role('admin'),(req,res)=>res.json(db.products));
app.patch('/api/admin/products/:id/approve',auth,role('admin'),(req,res)=>{const p=db.products.find(x=>x.id===+req.params.id);if(!p)return res.status(404).json({error:'Product not found'});p.approved=true;saveDB();res.json(p);});
app.delete('/api/admin/products/:id',auth,role('admin'),(req,res)=>{db.products=db.products.filter(x=>x.id!==+req.params.id);saveDB();res.json({message:'Product deleted.'});});
app.get('/api/admin/orders',auth,role('admin'),(req,res)=>res.json(db.orders.slice().reverse()));
app.patch('/api/admin/orders/:id/status',auth,role('admin'),(req,res)=>{const o=db.orders.find(x=>x.id===+req.params.id);if(!o)return res.status(404).json({error:'Order not found'});const allowed=['Received','Confirmed','Processing','Out for delivery','Delivered','Cancelled','Awaiting payment'];if(!allowed.includes(req.body.status))return res.status(400).json({error:'Invalid order status'});o.status=req.body.status;saveDB();res.json(o);});
app.get('/api/admin/sellers',auth,role('admin'),(req,res)=>res.json(db.users.filter(u=>u.role==='seller').map(publicUser)));
app.get('/api/admin/commissions',auth,role('admin'),(req,res)=>res.json(db.orders.flatMap(o=>(o.sellerBreakdown||[]).map(x=>({orderId:o.id,paymentStatus:o.paymentStatus,orderStatus:o.status,createdAt:o.createdAt,...x})))));
app.get('/admin',(req,res)=>res.sendFile(path.join(__dirname,'public','admin.html')));
app.get('/payment-result',(req,res)=>res.sendFile(path.join(__dirname,'public','payment-result.html')));
app.use((err,req,res,next)=>{console.error(err);res.status(500).json({error:'Server error.'});});
app.get('*',(req,res)=>res.sendFile(path.join(__dirname,'public','index.html')));
app.listen(PORT,'0.0.0.0',()=>console.log(`FurniMarket running at http://127.0.0.1:${PORT}`));
