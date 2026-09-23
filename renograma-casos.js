/* Casos del simulador de renograma. Los datos tecnicos salieron de los DICOM entregados a los
   estudiantes; cada archivo se reconoce por el hash FNV-1a de sus pixeles. La clinica esta
   desidentificada. Los valores del informe se muestran al terminar el caso, para comparar. */
'use strict';
// Puntos porcentuales de diferencia aceptable frente al informe. Mayor que en DMSA: a 3,3 mm de
// pixel la funcion diferencial depende del fondo y de la ventana temporal tanto como de la region.
const RENO_TOLERANCIA=10;
const RENO_ESTUDIANTES={Juan:[1,2],Magdalena:[3,4],Benjamin:[5,6],Diego:[7,8],Sofia:[9,10]};
// Protocolo comun a los diez casos: 60 frames de 1 s y 116 de 15 s, 30 minutos, detector posterior.
const RENO_PROTOCOLO={fases:[{frames:60,duracionMs:1000},{frames:116,duracionMs:15000}],angiograficoS:3,excretorMin:1,ventanaFuncion:[60,150]};
const RENO_PREGUNTAS_ORALES=[
 {titulo:'Indicación y radiofármaco',segundos:90,
  pregunta:'¿Qué pregunta clínica traen tus dos casos y por qué se responde con un estudio dinámico y no con un DMSA? Explica cómo se elimina el MAG3 y qué cambia si el radiofármaco fuera EC o DTPA.',
  preparar:'Usa el antecedente y revisa el radiofármaco registrado en «Información de la adquisición». En uno de los casos el informe y la cabecera no coinciden: dilo y explica cuál crees.'},
 {titulo:'Adquisición y fases',segundos:120,
  pregunta:'Describe la dinámica: matriz, píxel, dos fases con frames de 1 s y de 15 s, un detector. ¿Por qué se adquiere rápido al principio y lento después? ¿Qué se pierde en el caso que se interrumpió?',
  preparar:'Lee las fases en el paso 1 y cuenta los frames. Relaciona la duración del frame con el ruido de cada imagen y con lo que se quiere ver en cada fase.'},
 {titulo:'Suma temporal y curvas',segundos:120,
  pregunta:'Explica cómo construiste el mosaico angiográfico y el excretor, y por qué la curva se expresa en cuentas por segundo. ¿Qué pasaría en el frame 61 si no dividieras por la duración?',
  preparar:'Muestra tus dos mosaicos y la curva. Señala el minuto de la furosemida y el tramo con que calculaste la función diferencial.'},
 {titulo:'Lectura de las imágenes y las curvas',segundos:180,
  pregunta:'Para cada caso: perfusión, captación, excreción y respuesta al diurético. ¿Qué patrón tiene cada riñón y qué distingue una retención obstructiva de una funcional? Apóyate en la postmiccional.',
  preparar:'Un minuto y medio por caso sobre tus PNG. Distingue lo que ves de lo que interpretas, y reconoce lo que el estudio no puede resolver.'},
 {titulo:'Decisiones y control de calidad',segundos:90,
  pregunta:'Justifica una decisión propia: el ROI de fondo, la ventana de la función diferencial, el umbral del isocontorno. ¿Cuánto cambió el porcentaje al moverla y cómo se compara con el informe?',
  preparar:'Anota los valores que usaste. El simulador muestra el informe al final: explica la diferencia con argumentos técnicos.'}
];
const RENO_CASOS={
 1:{
  titulo:'Pelvis derecha dilatada con retención persistente',
  resumen:'Riñón derecho pequeño y adelgazado con una pelvis muy dilatada que no drena. Furosemida a los 20 minutos.',
  clinica:{antecedentes:'Defectos obstructivos de la pelvis renal y del uréter.',
   procedimiento:'Tc-99m MAG3, 8,49 mCi por vía endovenosa. Dinámica de 30 minutos con furosemida endovenosa a los 20 minutos. Estática postmiccional a los 60 minutos.'},
  furosemidaMin:20,farmaco:'MAG3',
  particularidades:['La carpeta original traía tres copias idénticas de la dinámica; en tu carpeta queda una. Si alguna vez ves varias, compara sus cuentas: si son iguales, es el mismo archivo.',
   'La curva derecha sube y no baja ni con el diurético. El informe advierte que eso no prueba obstrucción cuando la pelvis está tan dilatada y el riñón funciona poco.'],
  preguntas:['Una curva que sube durante 30 minutos y no responde al diurético: ¿por qué el informe no la llama obstrucción sin más? ¿Qué papel juegan la dilatación y la baja función?',
   '¿Qué le agrega la imagen postmiccional a los 60 minutos que la dinámica no tiene?',
   'La furosemida a los 20 minutos y no a tiempo 0: ¿qué ventaja y qué desventaja tiene cada protocolo?',
   'El riñón izquierdo aporta 76 %. ¿Es un riñón normal o uno que compensa? ¿Cómo lo distingues en la curva?'],
  referencia:{izq:76,der:24,impresion:'Signos de hidronefrosis derecha con marcado compromiso funcional del riñón ipsilateral. La retención persistente del trazador en la pelvis no necesariamente se debe a obstrucción, considerando el grado de dilatación y la baja función del riñón. Riñón izquierdo de características normales.'},
  archivos:{dinamica:'41fed7d4',postmiccional:'c63d616b'}
 },
 2:{
  titulo:'Obstrucción pieloureteral derecha con furosemida a tiempo 0',
  resumen:'El diurético se dio al inicio y la pelvis derecha retuvo igual. Curva derecha ascendente con máximo a los 17 minutos.',
  clinica:{antecedentes:'Hidronefrosis derecha. Sospecha de estenosis pieloureteral. Se dispone de uroTAC previo.',
   procedimiento:'Tc-99m MAG3, 6,5 mCi por vía endovenosa. Dinámica de 30 minutos con furosemida endovenosa a tiempo 0. Estática postmiccional a los 35 minutos.'},
  furosemidaMin:0,farmaco:'MAG3',
  particularidades:['Protocolo F+0: la furosemida se inyecta junto con el trazador. La curva derecha no tiene una fase de excreción; el «Tmáx» cae al final del estudio.',
   'El riñón derecho es algo más pequeño y capta poco: el fondo importa.'],
  preguntas:['Con furosemida a tiempo 0, ¿qué significa que una curva siga subiendo a los 17 minutos? Compara con el caso 1.',
   '¿Cómo define el equipo el Tmáx cuando la curva no tiene máximo? ¿Qué valor le darías tú y qué dirías en el informe?',
   'El uroTAC previo mostró hidronefrosis. ¿Qué aporta el renograma que la imagen anatómica no da?',
   'Función 27/73: ¿es compatible con una obstrucción que empezó hace poco o hace mucho? ¿Qué te falta para saberlo?'],
  referencia:{izq:73,der:27,impresion:'Dilatación de la pelvis renal derecha con signos sugerentes de obstrucción de la unión pieloureteral a ese lado. Moderado compromiso de la función renal relativa ipsilateral.'},
  archivos:{dinamica:'1588bf29',postmiccional:'8fe5c4e2'}
 },
 3:{
  titulo:'Riñón izquierdo atrófico, casi sin perfusión',
  resumen:'A la izquierda hay mínima perfusión y captación periférica, sin excreción. Estudio de 2022 con el mismo protocolo.',
  clinica:{antecedentes:'73 años. Tumor renal derecho. Atrofia renal izquierda con hidronefrosis.',
   procedimiento:'Tc-99m MAG3, 7 mCi por vía endovenosa. Dinámica de 30 minutos en proyección posterior con furosemida a los 20 minutos. Control postmiccional.'},
  furosemidaMin:20,farmaco:'MAG3',
  particularidades:['El riñón izquierdo casi no se ve: para dibujarlo usa la imagen suma de los primeros minutos y baja el techo de la escala. El isocontorno puede quedar vacío; usa polígono.',
   'El riñón derecho tiene un tumor conocido, pero en este estudio se ve conservado: el renograma mide función, no morfología.'],
  preguntas:['Un riñón con 6 % y perfusión mínima: ¿qué te dice la fase angiográfica que la fase de captación no?',
   'El riñón derecho tiene un tumor y aun así funciona 94 %. ¿Qué implica para la cirugía que se planea y qué querría saber el cirujano?',
   '¿Cómo dibujaste el ROI de un riñón que casi no se distingue del fondo, y cuánto pesa el fondo en su porcentaje?',
   'Leve retención pielocalicial derecha «de comportamiento funcional»: ¿qué patrón de curva justifica esa frase?'],
  referencia:{izq:6,der:94,impresion:'Hipofunción renal relativa izquierda severa, en contexto de antecedente de atrofia renal e hidronefrosis. Función renal derecha conservada, con leve retención pielocalicial de comportamiento funcional.'},
  archivos:{dinamica:'126857b2',postmiccional:'faf40b03'}
 },
 4:{
  titulo:'Patrón obstructivo de libro a derecha',
  resumen:'Perfusión disminuida, captación tardía, curva ascendente sin excreción, sin respuesta al diurético ni al control tardío.',
  clinica:{antecedentes:'Cáncer vesical operado. Estenosis pieloureteral derecha. Hidronefrosis derecha.',
   procedimiento:'Tc-99m MAG3, 6,2 mCi por vía endovenosa. Dinámica de 30 minutos en proyección posterior con furosemida a los 20 minutos. Estática postmiccional a los 60 minutos.'},
  furosemidaMin:20,farmaco:'MAG3',
  particularidades:['Aquí sí se ven las tres cosas juntas: perfusión menor que la aorta, captación tardía y curva que sube sin bajar. Es el caso para aprender el patrón obstructivo.',
   'El riñón derecho es un poco más grande y está horizontalizado.'],
  preguntas:['Enumera los tres hallazgos del riñón derecho en la angiográfica, la de captación y la de excreción. ¿Cuál es el más específico de obstrucción?',
   '¿Por qué se compara la perfusión renal con la aorta y no con el otro riñón?',
   'Cáncer vesical operado y estenosis pieloureteral: ¿qué relación puede haber entre ambos?',
   'Sin paso claro por el uréter derecho: ¿cómo lo verificaste en el mosaico excretor y en la postmiccional?'],
  referencia:{izq:72.5,der:27.5,impresion:'Acentuada hidroureteronefrosis derecha con signos de obstrucción pieloureteral significativa, asociada a moderado daño parenquimatoso a ese lado. Riñón izquierdo sin alteración evidente.'},
  archivos:{dinamica:'52fbc33b',postmiccional:'92088e4d'}
 },
 5:{
  titulo:'Dilatación izquierda que drena: hidronefrosis sin obstrucción',
  resumen:'Función simétrica. La pelvis izquierda se llena y luego vacía. El radiofármaco fue Tc-99m EC, aunque la cabecera dice MAG3.',
  clinica:{antecedentes:'Sospecha de estenosis pieloureteral izquierda. Se dispone de uroTAC previo.',
   procedimiento:'Tc-99m EC, 7,9 mCi por vía endovenosa. Dinámica de 30 minutos con furosemida a los 20 minutos. Estática postmiccional a los 60 minutos.'},
  furosemidaMin:20,farmaco:'EC',
  particularidades:['La cabecera DICOM registra «MAG3» pero el informe dice Tc-99m EC. El protocolo del equipo tenía el nombre fijo. Es el ejemplo de por qué la cabecera no reemplaza a la ficha.',
   'Curva izquierda con Tmáx a los 5,5 min y T½ de 21 min frente a 8,7 min a derecha: retención transitoria que responde.'],
  preguntas:['Etilenodicisteína frente a MAG3: ¿qué comparten y en qué difieren? ¿Cambia algo en la interpretación?',
   '¿Por qué la cabecera dice MAG3? ¿Qué otros datos de una cabecera pueden estar «heredados» del protocolo y no del paciente?',
   'Función 51/49 con una pelvis dilatada: ¿qué separa hidronefrosis de obstrucción en este estudio?',
   'T½ de 21 minutos a izquierda: ¿con qué criterio lo llamarías retardado y qué valor normal usas?'],
  referencia:{izq:51,der:49,impresion:'Signos de hidronefrosis izquierda, sin evidencias cintigráficas de obstrucción del tracto urinario. Función renal relativa dentro de límites normales.'},
  archivos:{dinamica:'5120bd2b',postmiccional:'8aa3606b'}
 },
 6:{
  titulo:'Riñón izquierdo enorme con curva plana',
  resumen:'Hidronefrosis izquierda severa de larga data. Riñón izquierdo muy aumentado con mínima captación; el derecho responde al diurético en 7 minutos.',
  clinica:{antecedentes:'35 años. Hidronefrosis izquierda severa. Estenosis pieloureteral izquierda operada en la infancia. Nefrostomía y catéter pigtail recientes.',
   procedimiento:'Tc-99m MAG3, 4 mCi por vía endovenosa. Dinámica de 30 minutos en proyección posterior con furosemida a los 15 minutos. Control postmiccional.'},
  furosemidaMin:15,farmaco:'MAG3',
  particularidades:['Furosemida a los 15 minutos, distinto de los demás casos. El informe da además el T½ post diurético del riñón derecho: 7 minutos.',
   'La dosis fue de 4 mCi, la más baja de la serie: imágenes más ruidosas.'],
  preguntas:['Una curva plana en un riñón enorme: ¿qué representa la actividad que sí se ve, parénquima o pelvis?',
   '¿Cómo calculaste el T½ post diurético del riñón derecho y qué valor normal usas?',
   'Nefrostomía y pigtail izquierdos: ¿cómo afectan lo que ves y lo que puedes concluir sobre la vía urinaria?',
   'Operado a los 11 meses de edad y hoy con 16 %: ¿qué habría mostrado un renograma en la infancia?'],
  referencia:{izq:16,der:84,tmedioPostDiureticoDer:7,impresion:'Hipofunción renal relativa izquierda severa en contexto de antecedente de hidronefrosis. Leve retención pielocalicial derecha de comportamiento funcional.'},
  archivos:{dinamica:'2faace9e',postmiccional:'05756bed'}
 },
 7:{
  titulo:'Dos detectores: anterior y posterior',
  resumen:'El único caso con dinámica anterior y posterior. Nefrolitiasis izquierda en estudio prequirúrgico; furosemida a tiempo 0.',
  clinica:{antecedentes:'53 años. Nefrolitiasis izquierda. Estudio prequirúrgico.',
   procedimiento:'Tc-99m MAG3, 5,3 mCi por vía endovenosa. Dinámica de 30 minutos en proyecciones anterior y posterior con furosemida a tiempo 0. Imagen postmiccional tardía.'},
  furosemidaMin:0,farmaco:'MAG3',
  particularidades:['Hay dos dinámicas de 176 frames: el detector a 0° es la posterior y el detector a 180° la anterior. La cuantificación se hace en la posterior; la anterior sirve para comparar y para discutir la profundidad.',
   'Es el único archivo de la serie que registra la dosis en la cabecera: 196 MBq.',
   'El equipo dio 33/67 en la posterior y 24/76 en la anterior: la misma paciente, dos porcentajes.'],
  preguntas:['¿Por qué la función diferencial cambia entre la anterior y la posterior? ¿Cuál informarías y por qué?',
   'En la posterior, ¿qué parte de la diferencia se debe a la profundidad y qué parte al fondo?',
   'Estudio prequirúrgico por nefrolitiasis: ¿qué decisión depende del porcentaje y del T½?',
   'La hipocaptación inferior izquierda «puede estar en relación a nefrolitiasis»: ¿qué otra cosa podría ser y cómo lo resolverías?'],
  referencia:{izq:33,der:67,tmedioIzq:10.5,tmedioDer:10.3,impresion:'Función renal relativa asimétrica, moderadamente disminuida a izquierda, asociada a menor tamaño y retracciones parenquimatosas compatibles con daño secundario. Hidronefrosis izquierda leve de tipo funcional, sin signos de uropatía obstructiva evidente. Riñón derecho de funcionalidad conservada.'},
  archivos:{dinamica:'2c6f4003',dinamicaAnterior:'82e5eb69',postmiccional:'d180172c'}
 },
 8:{
  titulo:'Sin antecedente: leer sin ayuda',
  resumen:'La orden médica no traía antecedente. Riñón izquierdo muy pequeño; derecho con retención transitoria funcional. Píxel de 3,9 mm.',
  clinica:{antecedentes:'No disponible en la orden médica.',
   procedimiento:'Tc-99m MAG3, 4,9 mCi por vía endovenosa. Dinámica de 30 minutos con estímulo diurético al minuto 0. Control post cambios posturales y postmiccional tardío.'},
  furosemidaMin:0,farmaco:'MAG3',
  particularidades:['El píxel es de 3,9 mm en vez de 3,3: el zoom de adquisición fue 1,23. Compruébalo en la información de la adquisición y piensa qué cambia.',
   'Sin antecedente, la lectura tiene que sostenerse sola en las imágenes y las curvas.'],
  preguntas:['¿Qué cambia en la imagen y en las cuentas por píxel cuando el zoom es 1,23 en vez de 1,45?',
   'Riñón izquierdo pequeño con 11 % y excreción proporcional a su captación: ¿qué patrón es y por qué no es obstructivo?',
   'El informe agrega un control post cambios posturales. ¿Para qué sirve mover al paciente antes de la imagen tardía?',
   'Sin antecedente clínico, ¿qué habrías pedido antes de informar y qué puedes afirmar sin ello?'],
  referencia:{izq:11.2,der:88.8,impresion:'Riñón izquierdo disminuido de tamaño con signos de daño parenquimatoso y compromiso de la función relativa, sin signos de obstrucción. Hidronefrosis derecha de tipo funcional, sin evidencia de uropatía obstructiva. Signos de daño parenquimatoso.'},
  archivos:{dinamica:'90e75218',postmiccional:'1f45cad6'}
 },
 9:{
  titulo:'Estudio interrumpido a los 22 minutos',
  resumen:'La adquisición se cortó por urgencia miccional: 29 frames vacíos al final. Masa renal derecha e hidronefrosis izquierda no obstructiva.',
  clinica:{antecedentes:'Tumor maligno del riñón derecho. Hidronefrosis izquierda. Se dispone de uroTAC previo.',
   procedimiento:'Tc-99m MAG3, 8,3 mCi por vía endovenosa. Dinámica en proyección posterior durante 22 minutos, interrumpida por urgencia miccional, con furosemida a tiempo 0. Estáticas tardías postmiccionales.'},
  furosemidaMin:0,farmaco:'MAG3',
  particularidades:['Los últimos 29 frames están en cero: la curva termina a los 22,8 minutos y el mosaico excretor tiene casillas vacías. No las rellenes ni las ocultes: explícalas.',
   'El defecto fotopénico del polo superior derecho es la masa conocida.'],
  preguntas:['¿Qué parámetros se pueden calcular con 22 minutos y cuáles no? ¿Cómo lo dirías en el informe?',
   'La curva izquierda sube, baja un poco y cae marcadamente después de orinar: ¿qué significa y por qué eso descarta obstrucción?',
   'Un defecto fotopénico por una masa: ¿qué esperarías del mismo riñón en un DMSA?',
   'Urgencia miccional con furosemida a tiempo 0: ¿cómo se previene y qué se pierde si se interrumpe?'],
  referencia:{izq:74.9,der:25.1,impresion:'Signos de acentuado daño parenquimatoso renal derecho y de hidronefrosis izquierda no obstructiva.'},
  archivos:{dinamica:'a1f75f5a',postmiccional:'d7982e67'}
 },
 10:{
  titulo:'El caso normal',
  resumen:'Hidroureteronefrosis izquierda por imágenes, pero el renograma es normal: función simétrica y sin retención.',
  clinica:{antecedentes:'Hidroureteronefrosis izquierda. Antecedente de cáncer testicular tratado, con linfadenectomía lumboaórtica y radioterapia a la cadena ganglionar izquierda. Se dispone de estudios tomográficos previos.',
   procedimiento:'Tc-99m MAG3, 5 mCi por vía endovenosa. Dinámica de 30 minutos con furosemida a tiempo 0. Estática postmiccional a los 60 minutos.'},
  furosemidaMin:0,farmaco:'MAG3',
  particularidades:['Es el único caso normal. Sirve de patrón para comparar las curvas de los demás.',
   'Radioterapia sobre la cadena ganglionar izquierda: piensa qué podría haberle pasado al uréter izquierdo y por qué el renograma no lo muestra.'],
  preguntas:['Describe la curva normal: perfusión, Tmáx, T½. ¿Qué valores obtuviste y con qué normalidad los comparas?',
   'Hidroureteronefrosis en el TAC y renograma normal: ¿cómo se explica y qué le dirías al urólogo?',
   'Radioterapia lumboaórtica izquierda: ¿qué complicación ureteral se busca y cuándo aparecería?',
   'Con furosemida a tiempo 0, ¿cómo se ve una excreción normal en el mosaico y en la postmiccional?'],
  referencia:{izq:48,der:52,impresion:'Examen sin evidencias cintigráficas de obstrucción del tracto urinario. Función renal diferencial dentro de límites normales.'},
  archivos:{dinamica:'5f346776',postmiccional:'a921f45d'}
 }
};
function renoReconocer(hash){for(const [n,c] of Object.entries(RENO_CASOS))for(const [rol,h] of Object.entries(c.archivos))if(h===hash)return {caso:Number(n),rol};return null;}
const RENO_ROLES={dinamica:'dinámica posterior',dinamicaAnterior:'dinámica anterior',postmiccional:'estática postmiccional'};
