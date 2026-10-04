
import { T, LanguageSwitch } from "../language";
/* eslint-disable @next/next/no-html-link-for-pages */

export default function GiftsGatePage() {
  return <main className="product-page gate-page gift-gate-page"><header className="product-header"><a className="gate-brand" href="/"><T>Bagas × Iga</T></a><LanguageSwitch /></header><section><div className="gift-gate-niche" aria-hidden="true" /><p><T>Gift catalogue</T></p><h1><T>Open this from your personal invitation.</T></h1><p><T>The catalogue uses your private invitation token so a reservation can belong to the correct guest.</T></p><a className="paper-button" href="/"><T>Return to invitation</T></a></section></main>;
}
