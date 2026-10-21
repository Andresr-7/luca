"""Cambia el logo de Luca en todos lados con un solo comando.

Uso:
    python3 herramientas/iconos.py mi-logo.png            # el fondo del ícono "maskable" se toma de la esquina del logo
    python3 herramientas/iconos.py mi-logo.png "#0071E3"  # o un color de fondo a tu gusto

Tu logo: imagen cuadrada (PNG o JPG) de 1024x1024 px, idealmente con su propio fondo y esquinas redondeadas.
Genera:
    logo/logo.png y logo/logo.svg      -> el logo que se ve dentro de la app (entrada, barra, resumen animado)
    icons/icon-192.png, icon-512.png    -> ícono de la app instalada
    icons/icon-maskable-512.png         -> ícono de Android (con margen de seguridad)
    icons/apple-touch-icon.png          -> ícono del iPhone
    icons/favicon-32.png                -> pestaña del navegador
Después: sube el número de CACHE en sw.js y publica. Para la APK de Android hay que volver a generarla.
Necesita Pillow: pip install pillow
"""
import base64, io, os, sys
from PIL import Image

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

def cuadrar(im):
    w, h = im.size
    if w == h: return im
    n = max(w, h); c = Image.new("RGBA", (n, n), (0, 0, 0, 0)); c.paste(im, ((n - w) // 2, (n - h) // 2)); return c

def color(hexa):
    hexa = hexa.lstrip("#"); return tuple(int(hexa[i:i + 2], 16) for i in (0, 2, 4)) + (255,)

def main():
    if len(sys.argv) < 2: print(__doc__); sys.exit(1)
    im = cuadrar(Image.open(sys.argv[1]).convert("RGBA"))
    if im.width < 512: print("Aviso: el logo es pequeño (" + str(im.width) + " px). Mejor usa 1024x1024.")
    fondo = color(sys.argv[2]) if len(sys.argv) > 2 else im.getpixel((im.width // 2, 2))
    if fondo[3] < 255: fondo = (0, 113, 227, 255)
    big = im.resize((1024, 1024), Image.LANCZOS)
    os.makedirs(os.path.join(RAIZ, "logo"), exist_ok=True)
    big.save(os.path.join(RAIZ, "logo", "logo.png"))
    buf = io.BytesIO(); im.resize((256, 256), Image.LANCZOS).save(buf, "PNG")
    svg = ('<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 100 100">'
           '<image width="100" height="100" href="data:image/png;base64,' + base64.b64encode(buf.getvalue()).decode() + '"/></svg>\n')
    open(os.path.join(RAIZ, "logo", "logo.svg"), "w").write(svg)
    ic = os.path.join(RAIZ, "icons")
    big.resize((192, 192), Image.LANCZOS).save(os.path.join(ic, "icon-192.png"))
    big.resize((512, 512), Image.LANCZOS).save(os.path.join(ic, "icon-512.png"))
    big.resize((32, 32), Image.LANCZOS).save(os.path.join(ic, "favicon-32.png"))
    m = Image.new("RGBA", (512, 512), fondo); s = int(512 * 0.8); m.alpha_composite(big.resize((s, s), Image.LANCZOS), ((512 - s) // 2,) * 2)
    m.save(os.path.join(ic, "icon-maskable-512.png"))
    a = Image.new("RGBA", (180, 180), fondo); a.alpha_composite(big.resize((180, 180), Image.LANCZOS)); a.convert("RGB").save(os.path.join(ic, "apple-touch-icon.png"))
    print("Listo: logo e íconos actualizados.")

if __name__ == "__main__":
    main()
