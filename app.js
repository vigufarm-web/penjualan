const $ = id => document.getElementById(id);
const apiOrigin = location.hostname === 'vigufarm-web.github.io' ? 'https://laporankebun.vercel.app' : location.origin;
let token = '', offset = 0, editing = null, busy = false, warningSignature = null, loadId = 0;
let summaryData = null;
let queued=[], batchKey='', batchSignature='';
const fields = {
  pisang_penjualan: [
    ['no_sj','No. Surat Jalan','text'], ['gudang','Asal gudang','text'], ['pembeli','Pembeli','text'],
    ['tipe','Tipe',['Penjualan','Sampel','Retur','Mutasi Internal','Ongkir'],true], ['jenis_barang','Jenis barang','text'],
    ['bentuk','Bentuk',['FH','CL','SL']], ['kelas','Kelas',['A','B','C','MIX','Reject']], ['kondisi','Kondisi',['Matang','Mentah','Reject']],
    ['jumlah_box','Jumlah box','integer'], ['berat_kg','Berat (kg)','number'], ['harga','Harga per satuan (Rp)','number'],
    ['nominal','Nominal (Rp), kosongkan untuk hitung otomatis','number'], ['dibayar','Sudah dibayar (Rp)','number'],
  ],
  padi_penjualan: [
    ['no_sj','No. Surat Jalan','text'], ['pembeli','Pembeli / tujuan','text'], ['tipe','Tipe',['Penjualan','Sampel','Retur','Mutasi Internal','Ongkir']],
    ['jenis','Jenis',['GKP','GKG','Beras','Dedak/Lainnya']], ['jumlah_sak','Jumlah sak / box','integer'], ['berat_kg','Berat (kg)','number',true],
    ['harga_kg','Harga/kg (Rp)','number'], ['nominal','Nominal (Rp), kosongkan untuk hitung otomatis','number'], ['dibayar','Sudah dibayar (Rp)','number'],
  ],
};

function message(element, text, error=false) { element.textContent=text; element.classList.toggle('error',error); }
function url(path) { return apiOrigin + '/api/input-client' + path; }
async function api(path,method='GET',data) {
  let res;
  try{res=await fetch(url(path),{method,credentials:'omit',headers:{...(token?{Authorization:'Bearer '+token}:{}),...(data===undefined?{}:{'Content-Type':'application/json'})},body:data===undefined?undefined:JSON.stringify(data)});}
  catch{throw new Error('Sambungan layanan Penjualan belum siap atau jaringan sedang bermasalah.');}
  const result=await res.json().catch(()=>null);
  if(res.status===404)throw new Error('Aplikasi Penjualan masih disiapkan. Sambungan data belum aktif.');
  if(res.status===401 && path==='/me'){token='';return {user:null};}
  if(!res.ok || !result)throw new Error(result?.error || 'Layanan belum tersedia.');
  if(path==='/login')token=result.token;
  if(path==='/logout')token='';
  return result;
}
async function showSession(){
  const {user}=await api('/me');$('login').hidden=!!user;$('sales').hidden=!user;
  if(!user){message($('status'),'Masuk dengan akun penjualan.');return;}
  message($('status'),`Masuk sebagai ${user.nama||user.username}.`);await refresh();loadSummary();
}
function drawSummary(){
  const table=summaryData?.tables.find(item=>item.table===$('type').value);
  if(!table)return;
  const item=table.selectedPeriods.find(p=>p.month===$('summary-month').value&&p.part===$('summary-part').value);
  const rp=value=>'Rp '+Number(value||0).toLocaleString('id-ID',{maximumFractionDigits:2});
  const values=[['Penjualan bersih',item?.net_sales],['Total tagihan termasuk ongkir',item?.billed],['Sudah dibayar',item?.paid],['Sisa tagihan',item?.outstanding]];
  $('summary-values').replaceChildren(...values.map(([label,value])=>{const card=document.createElement('div');card.className='dashboard-card';const name=document.createElement('span'),number=document.createElement('strong');name.textContent=label;number.textContent=rp(value);card.append(name,number);return card;}));
  const buyers=table.receivables.buyers.filter(b=>b.outstanding>0);
  $('summary-buyers').replaceChildren(...buyers.map(b=>{const tr=document.createElement('tr');for(const value of [b.buyer,b.open_documents,rp(b.outstanding)])tr.insertCell().textContent=value;return tr;}));
  if(!buyers.length){const tr=document.createElement('tr'),td=tr.insertCell();td.colSpan=3;td.textContent='Tidak ada sisa tagihan tercatat.';$('summary-buyers').append(tr);}
  message($('summary-status'),'');
}
async function loadSummary(){
  try{summaryData=await api('/excel/summary?tables=pisang_penjualan,padi_penjualan');if(!$('summary-month').value)$('summary-month').value=summaryData.today.slice(0,7);drawSummary();}
  catch(error){message($('summary-status'),'Ringkasan belum tersedia: '+error.message,true);}
}
async function refresh(){
  const ticket=++loadId, table=$('type').value;
  const data=await api('/records/'+table+'?'+new URLSearchParams({limit:'50',offset:String(offset),sort:'-tanggal'}));
  if(ticket!==loadId)return;
  const titles=['Tanggal',...fields[table].map(f=>f[1]),'Total (Rp)','Keterangan','Aksi'];
  const head=document.createElement('tr');for(const title of titles){const th=document.createElement('th');th.textContent=title;head.append(th);}$('head').replaceChildren(head);
  $('rows').replaceChildren(...data.rows.map(row=>{
    const tr=document.createElement('tr');for(const value of [row.tanggal,...fields[table].map(f=>row[f[0]]),row.total,row.keterangan])tr.insertCell().textContent=value??'—';
    const edit=document.createElement('button');edit.type='button';edit.className='secondary';edit.textContent='Revisi';edit.addEventListener('click',()=>openEditor(row));
    const remove=document.createElement('button');remove.type='button';remove.className='secondary';remove.textContent='Hapus';remove.addEventListener('click',()=>deleteRow(table,row));tr.insertCell().append(edit,remove);return tr;
  }));
  $('range').textContent=data.total?`${data.offset+1}–${data.offset+data.rows.length} dari ${data.total}`:'Belum ada data';
  $('prev').disabled=data.offset===0;$('next').disabled=data.offset+data.rows.length>=data.total;
}
async function deleteRow(table,row){
  const label=[row.tanggal,row.no_sj,row.pembeli,row.jenis_barang||row.jenis||row.tipe].filter(Boolean).join(' · ');
  if(!window.confirm('Hapus satu rincian ini?\n'+label+'\n\nRincian lain pada surat jalan yang sama tetap ada.'))return;
  try{
    if(!row.updated_at)throw new Error('Versi data tidak tersedia. Muat ulang sebelum menghapus.');
    await api('/t/'+table+'/'+row.id+'?'+new URLSearchParams({updated_at:row.updated_at}),'DELETE');
    await refresh();loadSummary();message($('status'),'Rincian berhasil dihapus.');
  }catch(error){message($('status'),error.message,true);}
}
function openEditor(row=null){
  editing=row;queued=[];batchKey='';batchSignature='';warningSignature=null;$('entry').reset();$('warning').hidden=true;$('warning-confirm').checked=false;message($('message'),'');
  const table=$('type').value;$('title').textContent=(row?'Revisi ':'Tambah ')+(table==='pisang_penjualan'?'penjualan Pisang':'penjualan Padi');
  $('queued-wrap').hidden=true;$('queued-list').replaceChildren();$('queue-detail').hidden=!!row;
  $('entry').elements.tanggal.value=row?.tanggal??new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Jakarta'}).format(new Date());
  $('entry').elements.keterangan.value=row?.keterangan??'';
  $('fields').replaceChildren(...fields[table].map(([key,label,type,required])=>{
    const wrapper=document.createElement('label');wrapper.append(document.createTextNode(label));const input=document.createElement(Array.isArray(type)?'select':'input');input.name=key;input.required=!!required;
    if(Array.isArray(type)){
      for(const value of ['',...type]){const option=document.createElement('option');option.value=value;option.textContent=value||'Pilih…';input.append(option);}
      if(row?.[key]&&!type.includes(row[key])){const option=document.createElement('option');option.value=row[key];option.textContent=row[key];input.append(option);}
    }else{input.type=type==='integer'||type==='number'?'number':type;if(type==='integer'||type==='number'){if(!['jumlah_box','berat_kg','nominal','dibayar'].includes(key))input.min='0';input.step=type==='integer'?'1':'any';}}
    input.value=row?.[key]??'';wrapper.append(input);return wrapper;
  }));
  if(table==='pisang_penjualan'){
    const form=$('entry'),f=form.elements;
    if(!row)f.tipe.value='Penjualan';
    const hint=document.createElement('p');hint.textContent='Gudang dibaca dari kode SMG/TGL pada nomor SJ. Isi jenis barang atau pilih bentuk, kelas, dan kondisi; periksa isian sebelum menyimpan.';$('fields').prepend(hint);
    let autoGudang='',autoProduct={};
    f.no_sj.addEventListener('input',()=>{const codes=new Set(String(f.no_sj.value).toUpperCase().split(/[^A-Z0-9]+/).filter(x=>['SMG','TGL'].includes(x)));if(!f.gudang.value||f.gudang.value===autoGudang){autoGudang=codes.size===1?[...codes][0]:'';f.gudang.value=autoGudang;}});
    f.jenis_barang.addEventListener('input',()=>{const tokens=String(f.jenis_barang.value).toUpperCase().split(/[^A-Z0-9]+/);for(const [key,values] of [['bentuk',['FH','CL','SL']],['kelas',['A','B','C','MIX']],['kondisi',['MATANG','MENTAH','REJECT']]]){const hits=[...new Set(tokens.filter(x=>values.includes(x)))];if(!f[key].value||f[key].value===autoProduct[key]){const option=hits.length===1?[...f[key].options].find(o=>o.value.toUpperCase()===hits[0]):null;autoProduct[key]=option?.value||'';f[key].value=autoProduct[key];}}});
    const wrap=document.createElement('label');wrap.textContent='Dasar harga jika box dan kg sama-sama diisi';const basis=document.createElement('select');basis.id='price-basis';for(const [value,label] of [['','Pilih jika diperlukan'],['box','Harga per box'],['kg','Harga per kg']]){const option=document.createElement('option');option.value=value;option.textContent=label;basis.append(option);}wrap.append(basis);$('fields').append(wrap);
  }
  $('editor').showModal();
}
function readCurrent(){
  const table=$('type').value,data=Object.fromEntries(new FormData($('entry')));
  for(const [key,,type] of fields[table])if(type==='number'||type==='integer')data[key]=data[key]===''?null:Number(data[key]);
  if(!editing&&(!String(data.no_sj||'').trim()||!String(data.pembeli||'').trim()))throw new Error('Isi nomor surat jalan dan pembeli.');
  const details=table==='pisang_penjualan'?['jenis_barang','bentuk','kelas','kondisi','jumlah_box','berat_kg','harga','nominal']:['jenis','jumlah_sak','berat_kg','harga_kg','nominal'];
  if(!details.some(k=>data[k]!==null&&data[k]!==''&&data[k]!==undefined))throw new Error('Isi rincian barang atau nominal sebelum menyimpan.');
  if(table==='pisang_penjualan' && data.jumlah_box && data.berat_kg && data.nominal===null){
    const basis=$('price-basis').value;if(!basis)throw new Error('Box dan kg sama-sama terisi. Pilih dasar harga atau isi nominal langsung.');
    data.nominal=Number(data.harga||0)*Number(basis==='box'?data.jumlah_box:data.berat_kg);
  }
  return data;
}
function redrawQueued(){
  $('queued-wrap').hidden=queued.length===0;
  $('queued-list').replaceChildren(...queued.map((row,index)=>{const li=document.createElement('li');li.textContent=[row.tipe,row.jenis_barang||row.jenis||'rincian',row.jumlah_box?row.jumlah_box+' box':'',row.berat_kg?row.berat_kg+' kg':'',row.nominal!==null?'Rp '+Number(row.nominal).toLocaleString('id-ID'):''].filter(Boolean).join(' · ')+' ';const button=document.createElement('button');button.type='button';button.className='secondary';button.textContent='Hapus rincian';button.addEventListener('click',()=>{queued.splice(index,1);redrawQueued();});li.append(button);return li;}));
}
$('queue-detail').addEventListener('click',()=>{
  try{
    if(!$('entry').reportValidity())return;
    const item=readCurrent();queued.push(item);redrawQueued();
    const f=$('entry').elements;
    for(const key of ['jenis_barang','bentuk','kelas','kondisi','jumlah_box','berat_kg','harga','nominal','dibayar','jenis','jumlah_sak','harga_kg','keterangan'])if(f[key])f[key].value='';
    if(f.tipe)f.tipe.value='Penjualan';if($('price-basis'))$('price-basis').value='';
    message($('message'),'Rincian disiapkan. Isi rincian berikutnya, lalu tekan Simpan untuk semuanya.');
  }catch(error){message($('message'),error.message,true);}
});
async function duplicates(table,value){
  const sj=String(value||'').trim();if(!sj)return [];
  const result=[];for(let start=0;;start+=100){
    const page=await api('/records/'+table+'?'+new URLSearchParams({q:sj,limit:'100',offset:String(start)}));
    result.push(...page.rows.filter(row=>String(row.no_sj||'').trim().toLocaleUpperCase('id-ID')===sj.toLocaleUpperCase('id-ID')&&row.id!==editing?.id));
    if(start+page.rows.length>=page.total)break;
    if(!page.rows.length||start>=9900)throw new Error('Pemeriksaan surat jalan belum selesai. Coba lagi.');
  }return result;
}
async function save(event){
  event.preventDefault();if(busy)return;
  const table=$('type').value;let data;try{data=readCurrent();}catch(error){message($('message'),error.message,true);return;}
  busy=true;$('save').disabled=true;$('cancel').disabled=true;
  try{
    const sjChanged=!editing||String(editing.no_sj||'').trim().toUpperCase()!==String(data.no_sj||'').trim().toUpperCase();
    const existing=sjChanged?await duplicates(table,data.no_sj):[],warn=existing.length>0||!String(data.no_sj||'').trim();
    const signature=JSON.stringify({data,matches:existing.map(r=>[r.id,r.updated_at])});
    if(warn&&(signature!==warningSignature||!$('warning-confirm').checked)){
      warningSignature=signature;$('warning-confirm').checked=false;
      const details=existing.slice(0,3).map(r=>[r.tanggal,r.pembeli,r.jenis_barang||r.jenis||r.tipe].filter(Boolean).join(' · ')).join('; ');
      $('warning-text').textContent=existing.length?`Nomor SJ sudah ada pada ${existing.length} baris: ${details}. Periksa apakah rincian tambahan sah. Untuk mengubah data lama, pilih Revisi.`:'Nomor SJ kosong sehingga tidak dapat diperiksa kesamaannya. Periksa daftar sebelum menyimpan.';
      $('warning').hidden=false;message($('message'),'Centang setelah memeriksa, lalu tekan Simpan lagi.',true);return;
    }
    if(editing)await api('/t/'+table+'/'+editing.id,'PUT',{...data,updated_at:editing.updated_at??null});else{
      const salesBatch=[...queued,data].map(item=>({...item,tanggal:data.tanggal,no_sj:data.no_sj,pembeli:data.pembeli,...(table==='pisang_penjualan'?{gudang:data.gudang}:{})}));
      if(new Set(salesBatch.map(item=>JSON.stringify(item))).size!==salesBatch.length)throw new Error('Ada rincian yang identik. Periksa sebelum menyimpan.');
      const currentSignature=JSON.stringify(salesBatch);if(currentSignature!==batchSignature){batchKey=crypto.randomUUID();batchSignature=currentSignature;}
      await api('/t/'+table,'POST',{batchId:batchKey,salesBatch});
    }
    $('editor').close();offset=0;await refresh();loadSummary();message($('status'),'Data tersimpan.');
  }catch(error){message($('message'),error.message,true);}finally{busy=false;$('save').disabled=false;$('cancel').disabled=false;}
}
async function excel(){
  const table=$('type').value,res=await fetch(url('/excel/download?tables='+encodeURIComponent(table)),{credentials:'omit',headers:{Authorization:'Bearer '+token}});
  if(!res.ok){const error=await res.json().catch(()=>null);throw new Error(error?.error||'Excel belum dapat diunduh.');}
  const object=URL.createObjectURL(await res.blob()),link=document.createElement('a');link.href=object;link.download='Penjualan - '+table+'.xlsx';document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(object),60000);
}
$('login').addEventListener('submit',async event=>{event.preventDefault();const form=event.currentTarget,button=form.querySelector('button');button.disabled=true;try{await api('/login','POST',Object.fromEntries(new FormData(form)));form.reset();await showSession();}catch(error){message($('status'),error.message,true);}finally{button.disabled=false;}});
$('logout').addEventListener('click',async()=>{try{await api('/logout','POST');offset=0;await showSession();}catch(error){message($('status'),error.message,true);}});
$('type').addEventListener('change',()=>{offset=0;drawSummary();refresh().catch(e=>message($('status'),e.message,true));});
$('summary-month').addEventListener('change',drawSummary);$('summary-part').addEventListener('change',drawSummary);
$('prev').addEventListener('click',()=>{offset=Math.max(0,offset-50);refresh().catch(e=>message($('status'),e.message,true));});
$('next').addEventListener('click',()=>{offset+=50;refresh().catch(e=>message($('status'),e.message,true));});
$('add').addEventListener('click',()=>openEditor());$('cancel').addEventListener('click',()=>$('editor').close());
$('editor').addEventListener('cancel',event=>{if(busy)event.preventDefault();});$('entry').addEventListener('submit',save);
$('excel').addEventListener('click',()=>excel().catch(e=>message($('status'),e.message,true)));
showSession().catch(error=>message($('status'),error.message,true));
