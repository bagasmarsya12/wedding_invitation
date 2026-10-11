'use client';
import { useState } from 'react';
import { rowText, type AdminAction, type AdminRow } from './admin-types';
import { GIFT_TRANSFER_IDS, GIFT_TRANSFER_LABELS, GIFT_TRANSFER_SETTING, readGiftTransfers, validateGiftTransfers } from '@/lib/gift-transfers';

function TransferSettings({ value, action }: { value: string; action: AdminAction }) {
  const initial = readGiftTransfers(value);
  const [busy, setBusy] = useState(false), [message, setMessage] = useState('');
  return <section className="admin-panel admin-wide cms-transfer-settings"><h3>Rekening & e-wallet</h3><p>Aktifkan metode yang ingin ditampilkan di Tanda kasih. Nomor rekening dan GoPay bisa disalin; DANA memakai tombol buka link.</p>
    <form onSubmit={async event => {
      event.preventDefault(); const data = new FormData(event.currentTarget);
      const input = Object.fromEntries(GIFT_TRANSFER_IDS.map(id => [id, { enabled: data.get(`${id}.enabled`) === 'on', recipient: data.get(`${id}.recipient`), destination: data.get(`${id}.destination`), cta: { id: data.get(`${id}.cta.id`), en: data.get(`${id}.cta.en`) } }]));
      const valid = validateGiftTransfers(input);
      if (!valid) { setMessage('Lengkapi nama penerima dan nomor/link setiap metode yang diaktifkan. Rekening hanya angka, GoPay nomor telepon, DANA link HTTPS.'); return; }
      setBusy(true); setMessage('');
      try { const result = await action('set_setting', { key: GIFT_TRANSFER_SETTING, value: JSON.stringify(valid) }); setMessage(result ? 'Pilihan tanda kasih tersimpan.' : 'Belum tersimpan. Periksa pesan di atas lalu coba lagi.'); }
      finally { setBusy(false); }
    }}><div className="cms-transfer-fields">{GIFT_TRANSFER_IDS.map(id => <fieldset key={id} disabled={busy}><legend>{GIFT_TRANSFER_LABELS[id]}</legend>
      <label className="check"><input type="checkbox" name={`${id}.enabled`} defaultChecked={initial[id].enabled} /> Tampilkan {GIFT_TRANSFER_LABELS[id]}</label>
      <label>Nama penerima {GIFT_TRANSFER_LABELS[id]}<input name={`${id}.recipient`} defaultValue={initial[id].recipient} maxLength={120} autoComplete="off" /></label>
      <label>{id === 'dana' ? 'Link DANA' : id === 'gopay' ? 'Nomor GoPay' : `Nomor rekening ${GIFT_TRANSFER_LABELS[id]}`}<input name={`${id}.destination`} defaultValue={initial[id].destination} maxLength={id === 'dana' ? 1000 : 40} type={id === 'dana' ? 'url' : 'text'} inputMode={id === 'dana' ? 'url' : id === 'gopay' ? 'tel' : 'numeric'} autoComplete="off" placeholder={id === 'dana' ? 'https://…' : undefined} /></label>
      <details className="cms-advanced-fields"><summary>Teks tombol {GIFT_TRANSFER_LABELS[id]}</summary><label>Indonesia<input name={`${id}.cta.id`} defaultValue={initial[id].cta.id} maxLength={100} placeholder={id === 'dana' ? 'Buka DANA' : id === 'gopay' ? 'Salin nomor' : 'Salin rekening'} /></label>
      <label>English<input name={`${id}.cta.en`} defaultValue={initial[id].cta.en} maxLength={100} placeholder={id === 'dana' ? 'Open DANA' : id === 'gopay' ? 'Copy phone number' : 'Copy account number'} /></label></details>
    </fieldset>)}</div><p className="cms-muted">Kosongkan teks tombol untuk memakai wording dari CMS → Tanda kasih. Metode nonaktif tidak tampil kepada tamu. Menyimpan form ini menggantikan tampilan detail rekening lama, tanpa menghapus isinya.</p><p role="status">{message}</p><button disabled={busy}>{busy ? 'Menyimpan…' : 'Simpan pilihan tanda kasih'}</button></form>
  </section>;
}

export function GiftSettings({settings,action}:{settings:AdminRow[];action:AdminAction}) {
  const [busy,setBusy]=useState(false);
  const transfers = rowText(settings.find(row => row.key === GIFT_TRANSFER_SETTING)?.value);
  return <><TransferSettings key={transfers} value={transfers} action={action} /><details className="cms-advanced-fields"><summary>Petunjuk pengiriman & format rekening lama</summary><p>Petunjuk pengiriman digunakan oleh hadiah yang membutuhkan pengiriman. Format rekening lama hanya menjadi cadangan jika empat metode di atas belum diatur.</p>{[
    ['cash_gift_details','Detail rekening','Nama bank, nomor rekening, dan nama pemilik.'],
    ['shipping_instructions','Petunjuk pengiriman','Nama penerima, alamat, dan catatan pengiriman.'],
  ].map(([key,label,hint])=>{
    const value=rowText(settings.find(row=>row.key===key)?.value);
    return <form key={key} onSubmit={async event=>{event.preventDefault();setBusy(true);try{await action('set_setting',{key,value:new FormData(event.currentTarget).get('value')});}finally{setBusy(false);}}}><label>{label}<textarea key={value} name="value" defaultValue={value} maxLength={2000} rows={4}/></label><p className="cms-muted">{hint} Kosongkan untuk menyembunyikan.</p><button disabled={busy}>Simpan {label.toLocaleLowerCase('id')}</button></form>;
  })}</details></>;
}
