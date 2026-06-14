// アセット import のデモ。photo.png は build 時に自動最適化（PNG ロスレス再圧縮）される。
import photo from "../photo.png";

export default function Photo() {
  return <img src={photo} width="128" height="128" alt="demo" data-testid="photo" />;
}
