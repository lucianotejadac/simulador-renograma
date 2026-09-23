# Simulador de renograma

Simulador educativo para procesar un cintigrama renal dinámico con Tc-99m MAG3, con interfaz inspirada en Windows 95. El estudiante carga la dinámica y la estática postmiccional de su caso, reconoce las dos fases de la adquisición, arma los mosaicos angiográfico y excretor, dibuja regiones renales, de fondo y aórtica, y obtiene las curvas de actividad-tiempo con función diferencial, tiempo al máximo y tiempo medio, como lo hace el equipo. Al terminar compara con el informe.

Sitio: <https://lucianotejadac.github.io/simulador-renograma/>

## Tutorial

El panel **Tutorial** pregunta al inicio qué caso te asignaron (1 a 10) y guía los pasos: cargar, reconocer la adquisición, fases y mosaicos, regiones, curvas y parámetros, exportar. Comprueba contra los archivos cargados que sean los del caso, señala los tropiezos donde ocurren y, al completar el caso, muestra la función diferencial y la impresión del informe para comparar. `?caso=N` en la URL abre el simulador en ese caso.

Enlaces por caso: [1](https://lucianotejadac.github.io/simulador-renograma/?caso=1) · [2](https://lucianotejadac.github.io/simulador-renograma/?caso=2) · [3](https://lucianotejadac.github.io/simulador-renograma/?caso=3) · [4](https://lucianotejadac.github.io/simulador-renograma/?caso=4) · [5](https://lucianotejadac.github.io/simulador-renograma/?caso=5) · [6](https://lucianotejadac.github.io/simulador-renograma/?caso=6) · [7](https://lucianotejadac.github.io/simulador-renograma/?caso=7) · [8](https://lucianotejadac.github.io/simulador-renograma/?caso=8) · [9](https://lucianotejadac.github.io/simulador-renograma/?caso=9) · [10](https://lucianotejadac.github.io/simulador-renograma/?caso=10).

## Productos

Tres PNG por caso: fase angiográfica, fase excretora con la postmiccional, y curvas con parámetros. Más un archivo `.renalproject` para retomar el trabajo con **Abrir proyecto…**.

## Archivos

- `index.html`, `renograma-app.js`, `renal.css`, `renograma.css`: la aplicación.
- `renal-core.js`, `renal-tutorial.js`: núcleo compartido con el simulador DMSA, idéntico en ambos repositorios.
- `renograma-casos.js`: los casos, con clínica desidentificada, hashes de los archivos, particularidades, preguntas y valores del informe.
- `vendor/dicomParser.min.js`: dicom-parser (MIT).

Las decisiones de diseño de los dos simuladores renales están en `simulador-dmsa/BITACORA.md`.

## Privacidad y alcance

La aplicación funciona íntegramente en el navegador. Los DICOM no se incluyen en este repositorio ni se envían a ningún servidor. Uso docente: no es un programa validado para diagnóstico ni para decisiones clínicas.
