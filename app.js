const $ = id => document.getElementById(id);
const apiOrigin = location.hostname === 'vigufarm-web.github.io' ? 'https://laporankebun.vercel.app' : location.origin;
let token = '', offset = 0, editing = null, busy = false, warningSignature = null, loadId = 0;
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
  message($('status'),`Masuk sebagai ${user.nama||user.username}.`);await refresh();
}
async function refresh(){
  const ticket=++loadId, table=$('type').value;
  const data=await api('/records/'+table+'?'+new URLSearchParams({limit:'50',offset:String(offset),sort:'-tanggal'}));
  if(ticket!==loadId)return;
  const titles=['Tanggal',...fields[table].map(f=>f[1]),'Total (Rp)','Keterangan','Aksi'];
  const head=document.createElement('tr');for(const title of titles){const th=document.createElement('th');th.textContent=title;head.append(th);}$('head').replaceChildren(head);
  $('rows').replaceChildren(...data.rows.map(row=>{
    const tr=document.createElement('tr');for(const value of [row.tanggal,...fields[table].map(f=>row[f[0]]),row.total,row.keterangan])tr.insertCell().textContent=value??'—';
    const edit=document.createElement('button');edit.type='button';edit.className='secondary';edit.textContent='Revisi';edit.addEventListener('click',()=>openEditor(row));tr.insertCell().append(edit);return tr;
  }));
  $('range').textContent=data.total?`${data.offset+1}–${data.offset+data.rows.length} dari ${data.total}`:'Belum ada data';
  $('prev').disabled=data.offset===0;$('next').disabled=data.offset+data.rows.length>=data.total;
}
function openEditor(row=null){
  editing=row;warningSignature=null;$('entry').reset();$('warning').hidden=true;$('warning-confirm').checked=false;message($('message'),'');
  const table=$('type').value;$('title').textContent=(row?'Revisi ':'Tambah ')+(table==='pisang_penjualan'?'penjualan Pisang':'penjualan Padi');
  $('entry').elements.tanggal.value=row?.tanggal??new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Jakarta'}).format(new Date());
  $('entry').elements.keterangan.value=row?.keterangan??'';
  $('fields').replaceChildren(...fields[table].map(([key,label,type,required])=>{
    const wrapper=document.createElement('label');wrapper.append(document.createTextNode(label));const input=document.createElement(Array.isArray(type)?'select':'input');input.name=key;input.required=!!required;
    if(Array.isArray(type)){
      for(const value of ['',...type]){const option=document.createElement('option');option.value=value;option.textContent=value||'Pilih…';input.append(option);}
      if(row?.[key]&&!type.includes(row[key])){const option=document.createElement('option');option.value=row[key];option.textContent=row[key];input.append(option);}
    }else{input.type=type==='integer'||type==='number'?'number':type;if(type==='integer'||type==='number'){input.min='0';input.step=type==='integer'?'1':'any';}}
    input.value=row?.[key]??'';wrapper.append(input);return wrapper;
  }));
  $('editor').showModal();
}
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
  const table=$('type').value,data=Object.fromEntries(new FormData($('entry')));
  for(const [key,,type] of fields[table])if(type==='number'||type==='integer')data[key]=data[key]===''?null:Number(data[key]);
  busy=true;$('save').disabled=true;$('cancel').disabled=true;
  try{
    const existing=await duplicates(table,data.no_sj),warn=existing.length>0||!String(data.no_sj||'').trim();
    const signature=JSON.stringify({data,matches:existing.map(r=>[r.id,r.updated_at])});
    if(warn&&(signature!==warningSignature||!$('warning-confirm').checked)){
      warningSignature=signature;$('warning-confirm').checked=false;
      const details=existing.slice(0,3).map(r=>[r.tanggal,r.pembeli,r.jenis_barang||r.jenis||r.tipe].filter(Boolean).join(' · ')).join('; ');
      $('warning-text').textContent=existing.length?`Nomor SJ sudah ada pada ${existing.length} baris: ${details}. Periksa apakah rincian tambahan sah. Untuk mengubah data lama, pilih Revisi.`:'Nomor SJ kosong sehingga tidak dapat diperiksa kesamaannya. Periksa daftar sebelum menyimpan.';
      $('warning').hidden=false;message($('message'),'Centang setelah memeriksa, lalu tekan Simpan lagi.',true);return;
    }
    if(editing)await api('/t/'+table+'/'+editing.id,'PUT',{...data,updated_at:editing.updated_at??null});else await api('/t/'+table,'POST',data);
    $('editor').close();offset=0;await refresh();message($('status'),'Data tersimpan.');
  }catch(error){message($('message'),error.message,true);}finally{busy=false;$('save').disabled=false;$('cancel').disabled=false;}
}
async function excel(){
  const table=$('type').value,res=await fetch(url('/excel/download?tables='+encodeURIComponent(table)),{credentials:'omit',headers:{Authorization:'Bearer '+token}});
  if(!res.ok){const error=await res.json().catch(()=>null);throw new Error(error?.error||'Excel belum dapat diunduh.');}
  const object=URL.createObjectURL(await res.blob()),link=document.createElement('a');link.href=object;link.download='Penjualan - '+table+'.xlsx';document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(object),60000);
}
$('login').addEventListener('submit',async event=>{event.preventDefault();const form=event.currentTarget,button=form.querySelector('button');button.disabled=true;try{await api('/login','POST',Object.fromEntries(new FormData(form)));form.reset();await showSession();}catch(error){message($('status'),error.message,true);}finally{button.disabled=false;}});
$('logout').addEventListener('click',async()=>{try{await api('/logout','POST');offset=0;await showSession();}catch(error){message($('status'),error.message,true);}});
$('type').addEventListener('change',()=>{offset=0;refresh().catch(e=>message($('status'),e.message,true));});
$('prev').addEventListener('click',()=>{offset=Math.max(0,offset-50);refresh().catch(e=>message($('status'),e.message,true));});
$('next').addEventListener('click',()=>{offset+=50;refresh().catch(e=>message($('status'),e.message,true));});
$('add').addEventListener('click',()=>openEditor());$('cancel').addEventListener('click',()=>$('editor').close());
$('editor').addEventListener('cancel',event=>{if(busy)event.preventDefault();});$('entry').addEventListener('submit',save);
$('excel').addEventListener('click',()=>excel().catch(e=>message($('status'),e.message,true)));
showSession().catch(error=>message($('status'),error.message,true));
