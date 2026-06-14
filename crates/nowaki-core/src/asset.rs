//! 画像アセットの最適化（pure-Rust。C 依存コーデックは使わず cross-compile 安全）。
//!
//! - 自動: PNG を再エンコードし、小さくなる場合だけ採用（メタデータも落ちる）。
//! - opt-in: import クエリ `?w=&h=&format=webp|jpeg|png&quality=` でリサイズ・形式変換・品質指定。
//!   例: `import hero from "./hero.jpg?w=800&format=webp"`。
//!
//! WebP はロスレスエンコード（image-webp）。SVG/ICO/動画等は対象外（そのまま）。

use anyhow::Result;
use image::codecs::jpeg::JpegEncoder;
use image::codecs::png::{CompressionType, FilterType as PngFilter, PngEncoder};
use image::codecs::webp::WebPEncoder;
use image::imageops::FilterType;
use image::{DynamicImage, ImageEncoder, ImageFormat};

#[derive(Clone, Copy, PartialEq, Eq)]
pub enum Fmt {
    Png,
    Jpeg,
    Webp,
}

impl Fmt {
    fn from_ext(ext: &str) -> Option<Fmt> {
        match ext.to_ascii_lowercase().as_str() {
            "png" => Some(Fmt::Png),
            "jpg" | "jpeg" => Some(Fmt::Jpeg),
            "webp" => Some(Fmt::Webp),
            _ => None,
        }
    }
    fn ext(self) -> &'static str {
        match self {
            Fmt::Png => "png",
            Fmt::Jpeg => "jpg",
            Fmt::Webp => "webp",
        }
    }
    fn image_format(self) -> ImageFormat {
        match self {
            Fmt::Png => ImageFormat::Png,
            Fmt::Jpeg => ImageFormat::Jpeg,
            Fmt::Webp => ImageFormat::WebP,
        }
    }
}

/// import クエリから決まる変換指定。
#[derive(Default, Clone)]
pub struct Transform {
    pub width: Option<u32>,
    pub height: Option<u32>,
    pub format: Option<Fmt>,
    pub quality: Option<u8>,
}

impl Transform {
    /// リサイズ・形式変換・品質のいずれも指定されていない（＝自動最適化のみ）。
    fn is_noop(&self) -> bool {
        self.width.is_none()
            && self.height.is_none()
            && self.format.is_none()
            && self.quality.is_none()
    }
}

/// クエリ文字列（"w=800&format=webp&quality=80"）を Transform にパースする。
pub fn parse_query(q: &str) -> Transform {
    let mut t = Transform::default();
    for pair in q.split('&').filter(|s| !s.is_empty()) {
        let (k, v) = pair.split_once('=').unwrap_or((pair, ""));
        match k {
            "w" | "width" => t.width = v.parse().ok(),
            "h" | "height" => t.height = v.parse().ok(),
            "q" | "quality" => t.quality = v.parse::<u8>().ok().map(|n| n.clamp(1, 100)),
            "format" | "f" => {
                t.format = match v.to_ascii_lowercase().as_str() {
                    "webp" => Some(Fmt::Webp),
                    "jpeg" | "jpg" => Some(Fmt::Jpeg),
                    "png" => Some(Fmt::Png),
                    _ => None,
                }
            }
            _ => {}
        }
    }
    t
}

/// バイト列を最適化する。戻り値 = (最適化後バイト, 出力拡張子)。
/// 対象外・失敗・サイズ増（自動時）は元のまま返す（壊さない）。
pub fn optimize(bytes: &[u8], ext: &str, t: &Transform) -> (Vec<u8>, String) {
    match try_optimize(bytes, ext, t) {
        Ok(Some(out)) => out,
        _ => (bytes.to_vec(), ext.to_string()),
    }
}

fn try_optimize(bytes: &[u8], ext: &str, t: &Transform) -> Result<Option<(Vec<u8>, String)>> {
    let Some(in_fmt) = Fmt::from_ext(ext) else {
        return Ok(None); // svg/ico/gif/動画などは画像処理しない
    };
    // 自動（クエリ無し）は PNG のロスレス再エンコードだけ。JPEG/WebP の自動再圧縮は
    // 劣化し得るので、明示的なクエリ（リサイズ・形式・品質）がある時だけ行う。
    if t.is_noop() && in_fmt != Fmt::Png {
        return Ok(None);
    }
    let out_fmt = t.format.unwrap_or(in_fmt);

    let mut img = image::load_from_memory_with_format(bytes, in_fmt.image_format())?;
    if t.width.is_some() || t.height.is_some() {
        img = resize(&img, t.width, t.height);
    }
    let out = encode(&img, out_fmt, t.quality)?;

    // 自動最適化（変換指定なし）で小さくならないなら、元を使う。
    if t.is_noop() && out.len() >= bytes.len() {
        return Ok(None);
    }
    Ok(Some((out, out_fmt.ext().to_string())))
}

// 片方だけ指定ならアスペクト比維持で内接、両方指定なら厳密リサイズ。
fn resize(img: &DynamicImage, w: Option<u32>, h: Option<u32>) -> DynamicImage {
    match (w, h) {
        (Some(w), Some(h)) => img.resize_exact(w, h, FilterType::Lanczos3),
        (Some(w), None) => img.resize(w, u32::MAX, FilterType::Lanczos3),
        (None, Some(h)) => img.resize(u32::MAX, h, FilterType::Lanczos3),
        (None, None) => img.clone(),
    }
}

fn encode(img: &DynamicImage, fmt: Fmt, quality: Option<u8>) -> Result<Vec<u8>> {
    let mut out = Vec::new();
    match fmt {
        Fmt::Png => {
            let enc =
                PngEncoder::new_with_quality(&mut out, CompressionType::Best, PngFilter::Adaptive);
            let rgba = img.to_rgba8();
            enc.write_image(
                rgba.as_raw(),
                rgba.width(),
                rgba.height(),
                image::ExtendedColorType::Rgba8,
            )?;
        }
        Fmt::Jpeg => {
            let q = quality.unwrap_or(80);
            let mut enc = JpegEncoder::new_with_quality(&mut out, q);
            let rgb = img.to_rgb8();
            enc.encode(
                rgb.as_raw(),
                rgb.width(),
                rgb.height(),
                image::ExtendedColorType::Rgb8,
            )?;
        }
        Fmt::Webp => {
            // image-webp はロスレスエンコード。
            let enc = WebPEncoder::new_lossless(&mut out);
            let rgba = img.to_rgba8();
            enc.write_image(
                rgba.as_raw(),
                rgba.width(),
                rgba.height(),
                image::ExtendedColorType::Rgba8,
            )?;
        }
    }
    Ok(out)
}

#[cfg(test)]
mod tests {
    use super::*;
    use image::{ImageBuffer, Rgba};
    use std::io::Cursor;

    // 合成画像（PNG バイト）を作る。
    fn sample_png() -> Vec<u8> {
        let img = ImageBuffer::from_fn(64, 48, |x, y| {
            Rgba([(x * 4) as u8, (y * 5) as u8, 128, 255])
        });
        let mut out = Vec::new();
        DynamicImage::ImageRgba8(img)
            .write_to(&mut Cursor::new(&mut out), ImageFormat::Png)
            .unwrap();
        out
    }

    #[test]
    fn parses_query() {
        let t = parse_query("w=800&format=webp&quality=80");
        assert_eq!(t.width, Some(800));
        assert_eq!(t.quality, Some(80));
        assert!(matches!(t.format, Some(Fmt::Webp)));
    }

    #[test]
    fn resize_changes_dimensions() {
        let png = sample_png();
        let t = Transform {
            width: Some(32),
            ..Default::default()
        };
        let (out, ext) = optimize(&png, "png", &t);
        assert_eq!(ext, "png");
        let decoded = image::load_from_memory(&out).unwrap();
        assert_eq!(decoded.width(), 32); // 64 → 32（アスペクト比維持）
    }

    #[test]
    fn converts_to_webp_and_jpeg() {
        let png = sample_png();
        let (webp, ext) = optimize(
            &png,
            "png",
            &Transform {
                format: Some(Fmt::Webp),
                ..Default::default()
            },
        );
        assert_eq!(ext, "webp");
        assert_eq!(image::guess_format(&webp).unwrap(), ImageFormat::WebP);

        let (jpg, ext) = optimize(
            &png,
            "png",
            &Transform {
                format: Some(Fmt::Jpeg),
                quality: Some(70),
                ..Default::default()
            },
        );
        assert_eq!(ext, "jpg");
        assert_eq!(image::guess_format(&jpg).unwrap(), ImageFormat::Jpeg);
    }

    #[test]
    fn non_image_passes_through() {
        let (out, ext) = optimize(b"<svg/>", "svg", &Transform::default());
        assert_eq!(out, b"<svg/>");
        assert_eq!(ext, "svg");
    }

    #[test]
    fn auto_png_recompresses_smaller() {
        // 圧縮の弱い PNG（CompressionType::Fast）を入力にすると、自動最適化（Best）で縮む。
        let img = ImageBuffer::from_fn(96, 96, |x, y| {
            Rgba([(x * 2) as u8, (y * 2) as u8, ((x + y) * 3) as u8, 255])
        });
        let mut weak = Vec::new();
        let enc =
            PngEncoder::new_with_quality(&mut weak, CompressionType::Fast, PngFilter::NoFilter);
        enc.write_image(
            DynamicImage::ImageRgba8(img).to_rgba8().as_raw(),
            96,
            96,
            image::ExtendedColorType::Rgba8,
        )
        .unwrap();

        let (out, ext) = optimize(&weak, "png", &Transform::default());
        assert_eq!(ext, "png");
        assert!(
            out.len() < weak.len(),
            "auto PNG opt should shrink: {} -> {}",
            weak.len(),
            out.len()
        );
    }
}
