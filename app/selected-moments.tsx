"use client";
import { Fragment, type ReactNode, useState } from "react";
import { LandingPhoto } from "./landing-photo";
import { T, useLanguage } from "./language";
import { PhotoViewer } from './photo-viewer';
import { PhotoCommentCard, usePhotoCommentCards } from './photo-comment-card';

export function SelectedMoments({ photos, children, active = true }: { photos: (string | null)[]; children?: ReactNode; active?: boolean }) {
  const { t, tField, blocks, language } = useLanguage();
  const caption=(index:number)=>blocks.photos[index]?.caption[language] ?? tField(`gallery.caption${index+1}`);
  const [selected, setSelected] = useState<number | null>(null);
  const comments=usePhotoCommentCards(photos.flatMap((src,index)=>src&&blocks.photos[index]?['gallery:'+blocks.photos[index].id]:[]));
  const available = photos.map((src, index) => src ? index : -1).filter(index => index >= 0);
  function step(offset: number) {
    if (selected === null) return;
    setSelected(available[(available.indexOf(selected) + offset + available.length) % available.length]);
  }
  function photograph(index: number, position = index) {
    const src = photos[index];
    return <Fragment key={blocks.photos[index]?.id??index}><figure className={`moment moment-${position + 1}`}>
      {src ? <button className="moment-open" type="button" aria-label={`${t("Open photograph")} ${index + 1}`} onClick={() => setSelected(index)}><LandingPhoto key={src} src={src} alt={caption(index)} defer active={active} /><span><T>Take a closer look</T></span></button>
        : <LandingPhoto src={null} alt="" />}
      <figcaption>{caption(index)}</figcaption>
      {src&&blocks.photos[index]&&<PhotoCommentCard photoKey={'gallery:'+blocks.photos[index].id} overview={comments.data} error={comments.error} onRead={()=>setSelected(index)}/>}
    </figure>{index === Math.min(2, photos.length - 1) ? children : null}</Fragment>;
  }
  const extraSpreads = Array.from({ length: Math.ceil(Math.max(0, photos.length - 10) / 5) }, (_, spread) => {
    const start = 10 + spread * 5;
    return Array.from({ length: Math.min(5, photos.length - start) }, (_, offset) => start + offset);
  });
  return <div className="v2-selected-moments memory-photographs" id="gallery" tabIndex={-1} role="group" aria-label={t("The Archive")}>
    <div className="moments-album">{photos.slice(0, 10).map((_, index) => photograph(index))}
      {extraSpreads.map(indices => <div className={`moments-album-extra-group${indices.length <= 2 ? ' moments-album-pair' : ''}`} key={blocks.photos[indices[0]]?.id??indices[0]}>
        {indices.map((index, position) => photograph(index, position))}
      </div>)}
      {photos.length === 0 ? children : null}
    </div>
    <PhotoViewer photo={selected!==null&&photos[selected]&&blocks.photos[selected]?{key:'gallery:'+blocks.photos[selected].id,src:photos[selected]!,caption:caption(selected)}:null} onClose={()=>setSelected(null)} onPrevious={available.length>1?()=>step(-1):undefined} onNext={available.length>1?()=>step(1):undefined}/>
  </div>;
}
