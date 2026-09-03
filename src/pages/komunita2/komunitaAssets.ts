/** Obrázky stránky /komunita: mapa z ciest v komunitaContent.ts na URL z Vite buildu. */
import heroIvan from "@/assets/images/Ivan-Jašík-HeroHero.webp";
import oMne from "@/assets/images/o-mne-ivan-jasik.png";
import vanecko from "@/assets/images/vanecko.webp";
import latkoczy from "@/assets/images/Latkoczy.webp";
import papik from "@/assets/images/papik.webp";
// Náhľady videí v štýle značky (béžový papier), nahrádzajú pôvodné čierne miniatúry.
import video1 from "@/assets/images/ukazka-ako-by-som-zacal.jpg";
import video2 from "@/assets/images/ukazka-investicny-byt.jpg";
import video3 from "@/assets/images/ukazka-mimoriadna-splatka.jpg";
import recenzia1 from "@/assets/images/recenzia-1.png";
import recenzia2 from "@/assets/images/recenzia-2.png";
import recenzia3 from "@/assets/images/recenzia-3.png";
import recenzia4 from "@/assets/images/recenzia-4.png";
import recenzia5 from "@/assets/images/recenzia-5.png";
import recenzia6 from "@/assets/images/recenzia-6.png";
import recenzia7 from "@/assets/images/recenzia-7.png";
import recenzia8 from "@/assets/images/recenzia-8.png";
import recenzia9 from "@/assets/images/recenzia-9.png";

const ASSETS: Record<string, string> = {
  "@/assets/images/Ivan-Jašík-HeroHero.webp": heroIvan,
  "@/assets/images/o-mne-ivan-jasik.png": oMne,
  "@/assets/images/vanecko.webp": vanecko,
  "@/assets/images/Latkoczy.webp": latkoczy,
  "@/assets/images/papik.webp": papik,
  "@/assets/images/Ako by som zacal investovat.webp": video1,
  "@/assets/images/Investicny byt.webp": video2,
  "@/assets/images/Mimoriadna splátka hypotéky.webp": video3,
  "@/assets/images/recenzia-1.png": recenzia1,
  "@/assets/images/recenzia-2.png": recenzia2,
  "@/assets/images/recenzia-3.png": recenzia3,
  "@/assets/images/recenzia-4.png": recenzia4,
  "@/assets/images/recenzia-5.png": recenzia5,
  "@/assets/images/recenzia-6.png": recenzia6,
  "@/assets/images/recenzia-7.png": recenzia7,
  "@/assets/images/recenzia-8.png": recenzia8,
  "@/assets/images/recenzia-9.png": recenzia9,
};

export const asset = (src: string): string => ASSETS[src] ?? src;
