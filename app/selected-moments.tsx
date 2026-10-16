"use client";
import { Fragment, type ReactNode, useState } from "react";
import { LandingPhoto } from "./landing-photo";
import { T, useLanguage } from "./language";
import { PhotoViewer } from './photo-viewer';
import { PhotoCommentCard, usePhotoCommentCards } from './photo-comment-card';
import { isHomepagePhoto } from '@/lib/website-content';

export function SelectedMoments({ photos, children, active = true }: { photos: (string | null)[]; children?: ReactNode; active?: boolean }) {
  const { t, tField, blocks, language } = useLanguage();
  const album=blocks.photos.flatMap((block,index)=>isHomepagePhoto(block)?[{...block,src:photos[index]}]:[]);
  const caption=(index:number)=>album[index]?.caption[language] ?? tField(`gallery.caption${index+1}`);
  const [selected, setSelected] = useState<number | null>(null);
  const comments=usePhotoCommentCards(album.flatMap(photo=>photo.src?['gallery:'+photo.id]:[]));
  const available = album.map((photo, index) => photo.src ? index : -1).filter(index => index >= 0);
  function step(offset: number) {
    if (selected === null) return;
    setSelected(available[(available.indexOf(selected) + offset + available.length) % available.length]);
  }
  function photograph(index: number, position = index) {
    const src = album[index].src;
    return <Fragment key={album[index].id}><figure className={`moment moment-${position + 1}`}>
      {src ? <button className="moment-open" type="button" aria-label={`${t("Open photograph")} ${index + 1}`} onClick={() => setSelected(index)}><LandingPhoto key={src} src={src} alt={caption(index)} defer active={active} /><span><T>Take a closer look</T></span></button>
        : <LandingPhoto src={null} alt="" />}
      <figcaption>{caption(index)}</figcaption>
      {src&&<PhotoCommentCard photoKey={'gallery:'+album[index].id} overview={comments.data} error={comments.error} onRead={()=>setSelected(index)}/>}
    </figure>{index === Math.min(2, album.length - 1) ? children : null}</Fragment>;
  }
  const extraSpreads = Array.from({ length: Math.ceil(Math.max(0, album.length - 10) / 5) }, (_, spread) => {
    const start = 10 + spread * 5;
    return Array.from({ length: Math.min(5, album.length - start) }, (_, offset) => start + offset);
  });
  return <div className="v2-selected-moments memory-photographs" id="gallery" tabIndex={-1} role="group" aria-label={t("The Archive")}>
    <div className="moments-album">{album.slice(0, 10).map((_, index) => photograph(index))}
      {extraSpreads.map(indices => <div className={`moments-album-extra-group${indices.length <= 2 ? ' moments-album-pair' : ''}`} key={album[indices[0]].id}>
        {indices.map((index, position) => photograph(index, position))}
      </div>)}
      {album.length === 0 ? children : null}
    </div>
    <PhotoViewer photo={selected!==null&&album[selected]?.src?{key:'gallery:'+album[selected].id,src:album[selected].src!,caption:caption(selected)}:null} onClose={()=>setSelected(null)} onPrevious={available.length>1?()=>step(-1):undefined} onNext={available.length>1?()=>step(1):undefined}/>
  </div>;
}
