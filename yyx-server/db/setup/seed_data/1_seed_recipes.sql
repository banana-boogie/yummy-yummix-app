BEGIN;
INSERT INTO recipes (
    name, steps, display_picture_url, difficulty, prep_time, total_time, portions,
    useful_items, nutritional_value, tips_and_tricks
) VALUES (
    'Arroz a la mexicana',
    '[
        {"section": null, "order": 1, "instruction": "Coloque en el vaso el jitomate, la cebolla, el ajo y el agua, licue 30 seg/vel 10."},
        {"section": null, "order": 2, "instruction": "Cuele con ayuda de un colador de malla fina y reserve el caldo de jitomate."},
        {"section": null, "order": 3, "instruction": "Sin lavar el vaso, coloque el aceite y el arroz, sofría 7 min/120°C//vel ."},
        {"section": null, "order": 4, "instruction": "Añada el caldo de jitomate reservado, la sal y el cubo de caldo de pollo, cocine 16 min/100°C//vel . Deje reposar 5 minutos antes de servir."}
    ]'::jsonb,
    '', '', 'fácil', 10, 40, '6 porciones',
    'colador de malla fina',
    '{"inf. nutricional": "por 1 porción", "calorías": "241 kcal", "proteína": "4 g", "carbohidratos": "44 g", "grasa": "5 g", "fibra": "1 g"}'::jsonb,
    'Si desea, puede añadir chícharos y zanahoria en cubos pequeños al sofreír el arroz.'
);

INSERT INTO recipes (
    name, steps, display_picture_url, difficulty, prep_time, total_time, portions,
    useful_items, nutritional_value, tips_and_tricks
) VALUES (
    'Bolillos caseros',
    '[
        {"section": null, "order": 1, "instruction": "Coloque en el vaso el agua y la levadura, caliente 3 min 30 seg/37°C/vel 1.5."},
        {"section": null, "order": 2, "instruction": "Añada la harina, la sal y el azúcar, amase Espiga /7 min."},
        {"section": null, "order": 3, "instruction": "Deje que la masa fermente dentro del vaso por 20-25 minutos."},
        {"section": null, "order": 4, "instruction": "Amase Espiga /5 min. Retire la masa del vaso, colóquela sobre una superficie plana y enharinada."},
        {"section": null, "order": 5, "instruction": "Forme una bola y divida en 8 porciones iguales. Forme figuras ovaladas con la masa, procurando que el pliegue quede en la parte inferior y coloque los bolillos sobre una charola dejando un espacio de 5 cm entre cada uno."},
        {"section": null, "order": 6, "instruction": "Con ayuda de un cuchillo filoso haga un corte al centro y a lo largo del pan con una profundidad de 1.5 cm."},
        {"section": null, "order": 7, "instruction": "Precaliente el horno a 190°C. Con un atomizador con agua rocíe los panes, cubra las charolas con un paño para cocina y deje reposar por 45 minutos."},
        {"section": null, "order": 8, "instruction": "Rocíe nuevamente los panes con agua, hornee por 15-18 minutos (190°C) o hasta que los panes estén dorados y ligeros."},
        {"section": null, "order": 9, "instruction": "Sirva tibios."}
    ]'::jsonb,
    '', '', 'medio', 20, 100, '8 porciones',
    'charola de horno, cuchillo de filo largo, horno, paño de cocina',
    '{"inf. nutricional": "por 1 porción", "calorías": "236 kcal", "proteína": "7 g", "carbohidratos": "49 g", "grasa": "1 g", "fibra": "2 g"}'::jsonb,
    'Para saber que los panes están listos, deben sonar huecos y estar ligeros. Guarde los panes en una bolsa de papel celofán o plástico para conservarlos.'
);

INSERT INTO recipes (
    name, steps, display_picture_url, difficulty, prep_time, total_time, portions,
    useful_items, nutritional_value, tips_and_tricks
) VALUES (
    'Baguette',
    '[
        {"section": null, "order": 1, "instruction": "Coloque el agua y la levadura prensada fresca o la levadura seca instantánea al vaso y caliente 2 min/37°C/vel 2. Mientras tanto, engrase un tazón grande y reserve."},
        {"section": null, "order": 2, "instruction": "Añada la harina de trigo y la sal, amase Espiga /2 min. Transfiera la masa al tazón. Cubra el tazón con plástico film o un trapo de cocina y deje fermentar hasta que doble su volumen (aprox. 1½ horas)."},
        {"section": null, "order": 3, "instruction": "Espolvoree la mesa con harina, use un cuchillo filoso para separar la masa en tres partes iguales. Aplane y estire cada parte formando un cilindro y reserve sobre la mesa enharinada. Espolvoree con harina, cubra con plástico film o con un trapo de cocina y deje reposar por 20 minutos."},
        {"section": null, "order": 4, "instruction": "De nuevo, aplane cada parte de la masa formando un rectángulo, teniendo cuidado de conservar las burbujas de aire atrapadas en la masa. Forme de nuevo un cilindro. Pellizque la masa con los dedos para sellar las orillas. Alargue el cilindro formando una baguette, enrollando de un lado para otro gentilmente presionando del centro de la baguette hacia las extremidades. Coloque las baguettes con el pliegue hacia abajo sobre papel encerado y coloque papel entre las baguettes para crear una pequeña pared entre ellas. Esto ayuda a que las baguettes mantengan su forma y a prevenir que se peguen entre ellas mientras fermentan. Cubra las baguettes con plástico film o un trapo de cocina y deje fermentar por otros 45 minutos."},
        {"section": null, "order": 5, "instruction": "20 minutos antes de que termine el tiempo de fermentación, coloque 2 charolas de horno en la parte más baja del horno, una charola en el penúltimo peldaño y la otra en el último peldaño del horno. Precaliente el horno a 250°C."},
        {"section": null, "order": 6, "instruction": "Prepare aprox. 100 g de de agua bien caliente en una taza y reserve. Haga cortes sobre las baguettes con un cuchillo filoso, formando tres lineas a lo largo de la masa. Deslice las baguettes, junto con el papel encerado sobre la charola que se encuentra en el penúltimo peldaño del horno. Rápidamente, pero también con cuidado, vierta el agua caliente sobre la charola del último peldaño para crear vapor y cierre el horno inmediatamente para atrapar el vapor dentro del mismo. Hornee por 20 minutos (250°C), o hasta que doren. Si las baguettes se aprecian ya muy doradas antes de que termine el tiempo de horneado, reduzca la temperatura del horno a 230°C. Deje que las baguettes se enfríen por 20 minutos antes de rebanar."}
    ]'::jsonb,
    '', '', 'avanzado', 30, 225, '3 piezas',
    'plástico film o trapo de cocina, papel encerado, charolas de horno, horno',
    '{"inf. nutricional": "por 1 pieza", "calorías": "604 kcal", "proteína": "19 g", "carbohidratos": "122 g", "grasa": "4 g", "fibra": "6 g"}'::jsonb,
    'Para revisar que las baguettes estén listas para hornear, presione con la yema del dedo ligeramente la masa. La endidura que quede del dedo, debe desaparecer lentamente. Si la masa vuelve a su forma rápidamente, quiere decir que no ha fermentado lo suficiente. Si la hendidura permanece en la masa, quiere decir que se ha sobre fermentado. El vapor creado al principio del horneado, le da a la baguette un efecto crujiente y una corteza dorada. Tenga mucho cuidado de no salpicarse con el agua caliente. Si lo desea puede omitir el vapor. Las baguettes siempre se disfrutan más recién horneadas. Las baguettes saben mejor si refrigera la masa antes de hornearla por toda la noche. Después de que la masa ha fermentado en el paso 2, ponche ligeramente la masa, cúbra el tazón con plástico film y refrigere. Al siguiente día proceda con el paso 3 como se indica en la receta. Las baguettes podrían necesitar de 10-20 minutos más para fermentar en el paso 4 antes de hornear.'
);

INSERT INTO recipes (
    name, steps, display_picture_url, difficulty, prep_time, total_time, portions,
    useful_items, nutritional_value, tips_and_tricks
) VALUES (
    'Pan de caja blanco',
    '[
        {"section": null, "order": 1, "instruction": "Coloque en el vaso el agua mineral, el azúcar, la mantequilla y la levadura, tempere 2 min/37°C/vel 1."},
        {"section": null, "order": 2, "instruction": "Añada la 373 g de harina, mezcle 10 seg/vel 6."},
        {"section": null, "order": 3, "instruction": "Añada el resto de la harina y la sal, amase Espiga /4 min. Deje reposar la masa dentro del vaso hasta que haya doblado su volumen por aprox. 30 minutos."},
        {"section": null, "order": 4, "instruction": "Precaliente el horno a 180°C. Engrase generosamente un molde rectangular por aprox. 31 x 15 x 10 cm con mantequilla. Haga una bola con la masa y forme un cilindro alargado, del tamaño del molde. Colóquela dentro del molde, empujándola con las manos para que llegue bien a los rincones. Deje el pan en un lugar templado hasta que doble su volumen."},
        {"section": null, "order": 5, "instruction": "Hornee por 30-40 minutos a 180°C. Desmolde en caliente sobre una rejilla para evitar que el pan se humedezca dentro del molde y se pegue. Deje enfriar completamente, corte en rebanadas y sirva."}
    ]'::jsonb,
    '', '', 'fácil', 10, 120, '24 rebanadas',
    'Sensor Thermomix®, horno, molde rectangular (31 x 15 x 10 cm aprox.), rejilla',
    '{"inf. nutricional": "por 1 rebanada", "calorías": "97 kcal", "proteína": "3 g", "carbohidratos": "19 g", "grasa": "1 g", "fibra": "1 g"}'::jsonb,
    'Con estas cantidades puede hacer un pan grande (de 31x15x10 cm) o dos pequeños (de 25x11x7,5 cm). Es importante desmoldar el pan mientras está caliente, Si se deja en el molde se humecerá y se pegará con facilidad en las paredes del molde.'
);

INSERT INTO recipes (
    name, steps, display_picture_url, difficulty, prep_time, total_time, portions,
    useful_items, nutritional_value, tips_and_tricks
) VALUES (
    'Piña colada',
    '[
        {"section": null, "order": 1, "instruction": "Ponga en el vaso el hielo, la piña y el azúcar. Triture 2 min/vel 5-10 progresivamente."},
        {"section": null, "order": 2, "instruction": "Añada la leche de coco y el ron. Mezcle 5 seg/vel 3."},
        {"section": null, "order": 3, "instruction": "Humedezca el borde de las copas con agua y apóyelas sobre un lecho de coco rallado. Decore el borde de cada copa un gajo de piña y sirva."}
    ]'::jsonb,
    '', '', 'fácil', 5, 5, '6 vasos',
    'copas de piña colada',
    '{"inf. nutricional": "por 1 vaso", "calorías": "316 kcal", "proteína": "1.45 g", "carbohidratos": "33.75 g", "grasa": "13 g", "fibra": "4.35 g"}'::jsonb,
    ''
);

INSERT INTO recipes (
    name, steps, display_picture_url, difficulty, prep_time, total_time, portions,
    useful_items, nutritional_value, tips_and_tricks
) VALUES (
    'Mojito',
    '[
        {"section": null, "order": 1, "instruction": "Ponga el hielo en el vaso y pique 4 seg/vel 6. Distribúyalo entre los 4 vasos."},
        {"section": null, "order": 2, "instruction": "Ponga en el vaso las limas, el azúcar y el ron. Mezcle 10 seg//vel 5."},
        {"section": null, "order": 3, "instruction": "Añada las hojas de menta y mezcle 10 seg//vel 3. Reparta la mezcla entre los 4 vasos, rellénelos con la soda y mezcle con una cuchara. Sirva inmediatamente."}
    ]'::jsonb,
    '', '', 'fácil', 5, 5, '4 vasos',
    'vasos altos',
    '{"inf. nutricional": "por 1 vaso", "calorías": "296 kcal", "proteína": "0.15 g", "carbohidratos": "37.75 g", "grasa": "0.05 g", "fibra": "0.7 g"}'::jsonb,
    'Puede decorar con hojas de menta.'
);

INSERT INTO recipes (
    name, steps, display_picture_url, difficulty, prep_time, total_time, portions,
    useful_items, nutritional_value, tips_and_tricks
) VALUES (
    'Cazuela de panela con espinacas y caldillo',
    '[
        {"section": null, "order": 1, "instruction": "Coloque en el vaso la cebolla, los ajos y el jitomate, muela 1 min/vel 10. Cuele con un colador de malla fina el puré de jitomate y regrese al vaso."},
        {"section": null, "order": 2, "instruction": "Añada el aceite, la sal, la pimienta, el comino en polvo y la espinaca, sin colocar el cubilete, cocine 15 min/100°C//vel ."},
        {"section": null, "order": 3, "instruction": "Añada el queso panela y cocine 5 min/100°C//vel . Sirva caliente"}
    ]'::jsonb,
    '', '', 'fácil', 10, 30, '6 porciones',
    'colador de malla fina',
    '{"inf. nutricional": "por 1 porción", "calorías": "200 kcal", "proteína": "14 g", "carbohidratos": "12 g", "grasa": "11 g", "grasa saturada": "1 g", "fibra": "2 g", "sodio": "399 mg"}'::jsonb,
    ''
);

INSERT INTO recipes (
    name, steps, display_picture_url, difficulty, prep_time, total_time, portions,
    useful_items, nutritional_value, tips_and_tricks
) VALUES (
    'Calabacitas con elote y cilantro',
    '[
        {"section": null, "order": 1, "instruction": "Coloque en el vaso las hojas de cilantro, pique 8 seg/vel 5. Transfiera a un tazón y reserve."},
        {"section": null, "order": 2, "instruction": "Coloque en el vaso la cebolla, el ajo y el aceite de olivo, pique 5 seg/vel 5. Sofría 5 min/120°C/vel 2."},
        {"section": null, "order": 3, "instruction": "Añada los granos de elote, la calabaza, el puré de tomate, la sal y la pimienta, cocine 10 min/120°C//vel ."},
        {"section": null, "order": 4, "instruction": "Transfiera a un tazón, espolvoree el cilantro picado y mezcle con ayuda de la espátula."},
        {"section": null, "order": 5, "instruction": "Sirva caliente."}
    ]'::jsonb,
    '', '', 'fácil', 5, 20, '6 porciones',
    '',
    '{"inf. nutricional": "por 1 porción", "calorías": "100 kcal", "proteína": "3 g", "carbohidratos": "14 g", "grasa": "5 g", "fibra": "4 g"}'::jsonb,
    'Si desea acompaña con queso panela y crema fresca.'
);

INSERT INTO recipes (
    name, steps, display_picture_url, difficulty, prep_time, total_time, portions,
    useful_items, nutritional_value, tips_and_tricks
) VALUES (
    'Sopa de tortilla',
    '[
        {"section": null, "order": 1, "instruction": "Coloque en el vaso el jitomate, la cebolla, el ajo y el agua, licue 30 seg/vel 10."},
        {"section": null, "order": 2, "instruction": "Cuele con ayuda de un colador de malla fina y reserve el caldo de jitomate."},
        {"section": null, "order": 3, "instruction": "Sin lavar el vaso, coloque el aceite y sofría 5 min/120°C//vel 1."},
        {"section": null, "order": 4, "instruction": "Añada el caldo de jitomate reservado, el cubo de caldo de pollo, la sal y la pimienta, cocine 10 min/100°C//vel 1."},
        {"section": null, "order": 5, "instruction": "Sirva caliente con las tortillas cortadas en tiras y fritas, el aguacate, el queso, la crema y el chile pasilla frito desmenuzado."}
    ]'::jsonb,
    '', '', 'fácil', 10, 25, '6 porciones',
    'colador de malla fina',
    '{"inf. nutricional": "por 1 porción", "calorías": "241 kcal", "proteína": "8 g", "carbohidratos": "31 g", "grasa": "10 g", "fibra": "2 g"}'::jsonb,
    'Puede sustituir las tortillas fritas por totopos.'
);

INSERT INTO recipes (
    name, steps, display_picture_url, difficulty, prep_time, total_time, portions,
    useful_items, nutritional_value, tips_and_tricks
) VALUES (
    'Sopa de fideo',
    '[
        {"section": null, "order": 1, "instruction": "Coloque en el vaso la cebolla, el ajo, los jitomates y el aceite, sofría Alta temperatura  e inicie Licuar /1 min."},
        {"section": null, "order": 2, "instruction": "Añada el agua, los fideos, el cubo de caldo de pollo y la sal fina, cocine 15 min/100°C//vel ."},
        {"section": null, "order": 3, "instruction": "Sirva caliente con crema y aguacate."}
    ]'::jsonb,
    '', '', 'fácil', 5, 35, '6 porciones',
    '',
    '{"inf. nutricional": "por 1 porción", "calorías": "241 kcal", "proteína": "8 g", "carbohidratos": "31 g", "grasa": "10 g", "fibra": "2 g"}'::jsonb,
    'Fideos tostados en horno: Precaliente el horno a 200°C. Coloque el fideo sobre una charola para horno y hornee por 10-15 minutos (200°C) o hasta que se hayan dorado, moviendo ocasionalmente para obtener un dorado uniforme, deje enfriar por completo y guarde los fideos tostados en un recipiente hermético. Fideos tostados en sartén: Coloque una sartén a fuego medio alto y tueste sin aceite el fideo moviendo constantemente hasta que se dore uniformemente, deje enfriar por completo y guarde en un recipiente hermético.'
);


INSERT INTO recipes (
    name, steps, display_picture_url, difficulty, prep_time, total_time, portions,
    useful_items, nutritional_value, tips_and_tricks
) VALUES (
    'Sopa de cebolla',
    '[
        {"section": null, "order": 1, "instruction": "Ponga el queso gruyère en el vaso y ralle 6 seg/vel 7. Ponga en un bol y reserve."},
        {"section": null, "order": 2, "instruction": "Ponga en el vaso las cebollas, el aceite, la mantequilla, la sal y la pimienta negra. Trocee 10 seg/vel 4 y sofría 10-15 min/120°C//vel 1. Con la espátula, rebañe el fondo del vaso para despegar las cebollas que se hayan caramelizado."},
        {"section": null, "order": 3, "instruction": "Añada la harina, el agua y la pastilla de caldo, mezcle 10 seg//vel 3 y programe 20 min/100°C//vel 1. Ajuste los condimentos a su gusto."},
        {"section": null, "order": 4, "instruction": "Precaliente el grill del horno a 210°C."},
        {"section": null, "order": 5, "instruction": "Reparta la sopa en cuencos resistentes al calor, ponga sobre cada uno una rebanada de pan tostado y espolvoree con el queso rallado reservado. Gratine bajo el grill durante 5-10 minutos o hasta que el queso esté dorado. Sirva inmediatamente."}
    ]'::jsonb,
    '', '', 'fácil', 20, 70, '6 raciones',
    'horno, cuencos para sopa resistentes al calor',
    '{"inf. nutricional": "por 1 ración", "calorías": "296 kcal", "proteína": "9 g", "carbohidratos": "33 g", "grasa": "14 g", "fibra": "0 g"}'::jsonb,
    'Puede sustituir el queso gruyère por queso manchego semicurado.'
);

INSERT INTO recipes (
    name, steps, display_picture_url, difficulty, prep_time, total_time, portions,
    useful_items, nutritional_value, tips_and_tricks
) VALUES (
    'Crema de calabacita',
    '[
        {"section": null, "order": 1, "instruction": "Coloque en el vaso la cebolla y el ajo, pique 3 seg/vel 5."},
        {"section": null, "order": 2, "instruction": "Añada el aceite y sofría 5 min/120°C/vel 1."},
        {"section": null, "order": 3, "instruction": "Añada la calabacita, el agua, el cubo de caldo de verdura (para 0,5L), la sal y la pimienta y cocine 15 min/100°C//vel ."},
        {"section": null, "order": 4, "instruction": "Añada la crema y licue 1 min/vel 5-10, aumentando progresivamente la velocidad."},
        {"section": null, "order": 5, "instruction": "Sirva caliente."}
    ]'::jsonb,
    '', '', 'fácil', 10, 25, '6 porciones',
    '',
    '{"inf. nutricional": "por 1 porción", "calorías": "87 kcal", "proteína": "2.9 g", "carbohidratos": "7 g", "grasa": "6 g", "grasa saturada": "3.4 g", "fibra": "2 g", "sodio": "638.1 mg"}'::jsonb,
    'Puede sustituir la crema por leche evaporada.'
);

INSERT INTO recipes (
    name, steps, display_picture_url, difficulty, prep_time, total_time, portions,
    useful_items, nutritional_value, tips_and_tricks
) VALUES (
    'Flan de queso crema',
    '[
        {"section": null, "order": 1, "instruction": "Coloque en el fondo de un molde rectangular el caramelo líquido y reserve."},
        {"section": null, "order": 2, "instruction": "Coloque en el vaso el queso crema, la leche condensada, la leche evaporada, los huevos y la vainilla, mezcle 30 seg/vel 4."},
        {"section": null, "order": 3, "instruction": "Vierta la mezcla en el molde preparado, cubra con papel aluminio y coloque en el recipiente Varoma."},
        {"section": null, "order": 4, "instruction": "Coloque en el vaso 500 g de agua, coloque el recipiente Varoma en su posición y cocine 40 min/Varoma/vel 2."},
        {"section": null, "order": 5, "instruction": "Retire el recipiente Varoma, deje enfriar el flan por completo y refrigere por 3 horas o hasta que esté firme. Desmolde y sirva."}
    ]'::jsonb,
    '', '', 'fácil', 20, 240, '10 porciones',
    'papel aluminio, refrigerador, molde rectangular',
    '{"inf. nutricional": "por 1 porción", "calorías": "296 kcal", "proteína": "9 g", "carbohidratos": "33 g", "grasa": "14 g", "fibra": "0 g"}'::jsonb,
    'Utilice un molde rectangular que quepa dentro del recipiente Varoma. Si no consigue caramelo líquido, coloque 40 g de azúcar en el molde y coloque bajo una flama baja, hasta que se derrita y tome un color dorado en lugar del paso 1. En lugar de la vainilla, añada 1 cucharada de café soluble.'
);

INSERT INTO recipes (
    name, steps, display_picture_url, difficulty, prep_time, total_time, portions,
    useful_items, nutritional_value, tips_and_tricks
) VALUES (
    'Pan de leche',
    '[
        {"section": null, "order": 1, "instruction": "Engrase un tazón grande y reserve. Coloque en el vaso la leche, la mantequilla, la levadura prensada fresca o la levadura seca instantánea y el azúcar, caliente 3 min/37°C/vel 2."},
        {"section": null, "order": 2, "instruction": "Añada la harina de trigo y la sal, amase Espiga /3 min. Transfiera la masa en el tazón, cubra con plástico film o un trapo de cocina húmedo y deje fermentar en un lugar tibio hasta que doble su volumen (aprox. 1 hora)."},
        {"section": null, "order": 3, "instruction": "Cubra una charola de horno con papel encerado y reserve. Divida la masa en 3 partes y forme tiras con cada una (aprox. 45 cm). Junte las 3 tiras de un extremo y forme una trenza juntando al final de la trenza los extremos. Coloque la trenza en la charola de horno, cubra con plástico film o con una toalla húmeda y deje fermentar de nuevo en un lugar tibio hasta que doble su volumen (aprox. 30 minutos). Mientras tanto, precaliente el horno a 180°C."},
        {"section": null, "order": 4, "instruction": "Barnice con el huevo batido. Inserte el Thermomix® Sensor en el centro del molde. Asegúrese de que el termómetro y la muesca de seguridad quedan insertados totalmente en el molde y no toque la base, hornee por 25-30 minutos a 180°C o hasta que el pan suene hueco al golpearlo por debajo. Deje enfriar en una rejilla antes de rebanarlo."}
    ]'::jsonb,
    '', '', 'medio', 20, 140, '30 rebanadas',
    'Sensor Thermomix®, plástico film o trapo de cocina, charola y papel encerado, horno, brocha para barnizar, rejilla',
    '{"inf. nutricional": "por 1 rebanada", "calorías": "93 kcal", "proteína": "3 g", "carbohidratos": "16 g", "grasa": "2 g", "fibra": "1 g"}'::jsonb,
    'El pan de leche o Zopf, es tradicionalmente servido en Suiza los domingos por la mañana en el desayuno. La masa será un poco pegajosa. Si la masa parece demasiado húmeda después del paso 2, añada 1 cucharada de harina y amase por 30 segundos más. Espolvoree con almendras fileteadas o azúcar después de barnizar con el huevo. Un minuto antes que termine el amasado del paso 2, añada 80 g de pasitas. Con la masa, forme un pequeño hombre. Use pasitas para formar los ojos y los botones.'
);

INSERT INTO recipes (
    name, steps, display_picture_url, difficulty, prep_time, total_time, portions,
    useful_items, nutritional_value, tips_and_tricks
) VALUES (
    'Panqué de nuez glaseado',
    '[
        {"section": "Bizcocho", "order": 1, "instruction": "Precaliente el horno a 180°C. Engrase y enharine un molde de panqué y reserve."},
        {"section": "Bizcocho", "order": 2, "instruction": "Coloque en el vaso las nueces, pique 5 seg/vel 7. Transfiera a un tazón y reserve."},
        {"section": "Bizcocho", "order": 3, "instruction": "Coloque en el vaso la mantequilla, el azúcar moscabada y los huevos, mezcle 20 seg/vel 4."},
        {"section": "Bizcocho", "order": 4, "instruction": "Añada la leche, la harina, el polvo para hornear y las nueces reservadas, mezcle 20 seg/vel 6. Vierta la mezcla en el molde preparado."},
        {"section": "Bizcocho", "order": 5, "instruction": "Hornee por 40 minutos (180°C). Deje templar por 20 minutos antes de desmoldar. Lave y seque el vaso."},
        {"section": "Glaseado", "order": 1, "instruction": "Coloque en el vaso las nueces, pique 2 seg/vel 4. Transfiera a un tazón y reserve."},
        {"section": "Glaseado", "order": 2, "instruction": "Coloque en el vaso el azúcar moscabada y pulverice 15 seg/vel 10."},
        {"section": "Glaseado", "order": 3, "instruction": "Añada la mantequilla y el jarabe de maple, mezcle 30 seg/vel 7. Vierta el glaseado sobre el panqué, espolvoree con las nueces picadas. Rebane y sirva."}
    ]'::jsonb,
    '', '', 'medio', 20, 90, '10 rebanadas',
    'horno, molde de panqué (31 x 15 x 10 cm)',
    '{"inf. nutricional": "por 1 rebanada", "calorías": "432 kcal", "proteína": "6 g", "carbohidratos": "51 g", "grasa": "24 g", "fibra": "2 g"}'::jsonb,
    ''
);

INSERT INTO recipes (
    name, steps, display_picture_url, difficulty, prep_time, total_time, portions,
    useful_items, nutritional_value, tips_and_tricks
) VALUES (
    'Nieve rápida de fruta',
    '[
        {"section": null, "order": 1, "instruction": "Coloque el azúcar en el vaso y pulverice 15 seg/vel 10."},
        {"section": null, "order": 2, "instruction": "Añada el jugo de limón y la fruta variada, en trozos, pique 10 seg/vel 5."},
        {"section": null, "order": 3, "instruction": "Añada los hielos, triture 45 seg/vel 9. Baje los restos de las paredes del vaso con ayuda de la espátula, mezcle bien con la espátula, triture 45 seg/vel 9"}
    ]'::jsonb,
    '', '', 'fácil', 5, 5, '8 porciones',
    '',
    '{"inf. nutricional": "por 1 porción", "calorías": "6 kcal", "proteína": "0.2 g", "carbohidratos": "25.6 g", "grasa": "0 g", "grasa saturada": "0 g", "fibra": "0.4 g", "sodio": "6.4 mg"}'::jsonb,
    'Para una consistencia más cremosa, añada una clara de huevo en el paso 2. En lugar de pelar el limón, puede exprimir el jugo y añadirlo en el paso 2.'
);

INSERT INTO recipes (
    name, steps, display_picture_url, difficulty, prep_time, total_time, portions,
    useful_items, nutritional_value, tips_and_tricks
) VALUES (
    'Crema de champiñones',
    '[
        {"section": null, "order": 1, "instruction": "Coloque en el vaso la cebolla y el ajo, pique 3 seg/vel 5."},
        {"section": null, "order": 2, "instruction": "Añada el aceite y sofría 5 min/120°C/vel 1."},
        {"section": null, "order": 3, "instruction": "Añada los champiñones, el agua, el cubo de caldo de verdura (para 0,5L), la sal y la pimienta y cocine 15 min/100°C//vel ."},
        {"section": null, "order": 4, "instruction": "Añada la crema y licue 1 min/vel 5-10, aumentando progresivamente la velocidad."},
        {"section": null, "order": 5, "instruction": "Sirva caliente."}
    ]'::jsonb,
    '', '', 'fácil', 10, 25, '6 porciones',
    '',
    '{"inf. nutricional": "por 1 porción", "calorías": "87 kcal", "proteína": "2.9 g", "carbohidratos": "7 g", "grasa": "6 g", "grasa saturada": "3.4 g", "fibra": "2 g", "sodio": "638.1 mg"}'::jsonb,
    'Puede sustituir la crema por leche evaporada.'
);


INSERT INTO recipes (
    name, steps, display_picture_url, difficulty, prep_time, total_time, portions,
    useful_items, nutritional_value, tips_and_tricks
) VALUES (
    'Galletas de mantequilla',
    '[
        {"section": null, "order": 1, "instruction": "Precaliente el horno a 180°C. Cubra una charola de horno con papel encerado y reserve."},
        {"section": null, "order": 2, "instruction": "Coloque en el vaso la harina, el azúcar, la mantequilla, el huevo y el polvo para hornear, mezcle 20 seg/vel 6."},
        {"section": null, "order": 3, "instruction": "Coloque un poco de azúcar en un plato. Tome 1 cucharada de la masa y forme una bola pequeña. Hunda una parte de la bola de masa en el azúcar, colóquela en la charola de horno y aplane con un tenedor formando una galleta redonda (aprox. Ø 4 cm). Realice el mismo procedimiento con el resto de la masa y hornee por 15-20 minutos (180°C) o hasta que doren ligeramente. Deje enfriar en una rejilla antes de servir o guardar en un recipiente hermético."}
    ]'::jsonb,
    '', '', 'fácil', 20, 50, '30 piezas',
    'horno, charola y papel encerado, recipiente hermético, rejilla',
    '{"inf. nutricional": "por 1 pieza", "calorías": "82 kcal", "proteína": "1 g", "carbohidratos": "12 g", "grasa": "3 g", "fibra": "0 g"}'::jsonb,
    'En el paso 2, añada otros sabores como azúcar de vainila, ralladura de limón, ralladura de naranja, canela molida o fruta confitada picada.'
);

INSERT INTO recipes (
    name, steps, display_picture_url, difficulty, prep_time, total_time, portions,
    useful_items, nutritional_value, tips_and_tricks
) VALUES (
    'Tinga de pollo',
    '[
        {"section": null, "order": 1, "instruction": "Coloque en el vaso la cebolla y el aceite, sofría Alta temperatura ."},
        {"section": null, "order": 2, "instruction": "Coloque en el vaso el jitomate y pique 3 seg/vel 4.5. Baje los restos de las paredes del vaso con la espátula."},
        {"section": null, "order": 3, "instruction": "Añada la pechuga de pollo deshuesada y sin piel, en trozos, los cubos de caldo de pollo, el chile chipotle adobado y las hojas de laurel, cocine 18 min/100°C//vel 1 y deshebre 4 seg//vel 4.5."},
        {"section": null, "order": 4, "instruction": "Sirva la tinga sobre tostadas, decore con crema y queso panela."}
    ]'::jsonb,
    '', '', 'fácil', 10, 30, '6 porciones',
    '',
    '{"inf. nutricional": "por 1 porción", "calorías": "8 kcal", "proteína": "68.8 g", "carbohidratos": "121.8 g", "grasa": "47.6 g", "grasa saturada": "22.2 g", "fibra": "2 g", "sodio": "1802.2 mg"}'::jsonb,
    ''
);

INSERT INTO recipes (
    name, steps, display_picture_url, difficulty, prep_time, total_time, portions,
    useful_items, nutritional_value, tips_and_tricks
) VALUES (
    'Pollo con mole',
    '[
        {"section": null, "order": 1, "instruction": "Coloque en el vaso los chiles secos, pulverice 10 seg/vel 10."},
        {"section": null, "order": 2, "instruction": "Añada el romero, el tomillo seco, las pimientas gordas, el ajonjolí, la rama de canela, las almendras, las pepitas de calabaza, los cacahuates tostados, la cebolla y los ajos, sofría Alta temperatura ."},
        {"section": null, "order": 3, "instruction": "Añada el jitomate, las pasas, el bolillo seco, la sal, los cubos de caldo de pollo, la manteca de cerdo, el agua y la tablilla de chocolate, licue 1 min/vel 10."},
        {"section": null, "order": 4, "instruction": "Añada la pechuga de pollo deshuesada y sin piel, en trozos, mezcle bien el contenido con la espátula, coloque el cestillo sobre la tapa en lugar del cubilete y cocine 20 min/100°C//vel 1. Deshebre 4 seg//vel 4. Sirva inmediatamente caliente."}
    ]'::jsonb,
    '', '', 'fácil', 10, 60, '8 porciones',
    '',
    '{"inf. nutricional": "por 1 porción", "calorías": "331 kcal", "proteína": "34 g", "carbohidratos": "20 g", "grasa": "13 g", "fibra": "1 g"}'::jsonb,
    'Para preparar más pollo con mole: Añada en el paso 3, 500 g más de agua y continúe con la receta. En el paso 4, añada 500 g más de pechuga de pollo deshuesada y sin piel, en trozos y aumente el tiempo de cocción a 40 min/100°C//vel 1.'
);

INSERT INTO recipes (
    name, steps, display_picture_url, difficulty, prep_time, total_time, portions,
    useful_items, nutritional_value, tips_and_tricks
) VALUES (
    'Pescado a la veracruzana',
    '[
        {"section": null, "order": 1, "instruction": "Coloque en el vaso 150 g de la cebolla en trozos, los dientes de ajo, el aceite y el jitomate, pique 5 seg/vel 5 y sofría 10 min/120°C/vel 1. Mientras tanto, corte 150 g de cebolla en rodajas y reserve."},
        {"section": null, "order": 2, "instruction": "Añada la hoja de laurel, sal y pimienta al gusto, el azúcar, las alcaparras y las aceitunas."},
        {"section": null, "order": 3, "instruction": "Coloque el recipiente Varoma en su posición y añada los filetes de pescado, espolvoree con sal y pimienta al gusto, añada las rodajas de cebolla y los chiles güeros, tape y cocine al vapor 18 min/Varoma/vel 1. Rectifique la cocción del pescado, si es necesario, cocine 2-5 min/Varoma/vel 1."},
        {"section": null, "order": 4, "instruction": "Sirva los filetes con rodajas de cebolla y chiles, bañados en la salsa caliente."}
    ]'::jsonb,
    '', '', 'fácil', 10, 30, '6 porciones',
    '',
    '{"inf. nutricional": "por 1 porción", "calorías": "304 kcal", "proteína": "34 g", "carbohidratos": "12 g", "grasa": "14 g", "grasa saturada": "3 g", "fibra": "3 g", "sodio": "509 mg"}'::jsonb,
    'Le recomendamos utilizar filetes de pescado blanco (p. ej, huachinango, robalo, tilapia, etc)'
);

INSERT INTO recipes (
    name, steps, display_picture_url, difficulty, prep_time, total_time, portions,
    useful_items, nutritional_value, tips_and_tricks
) VALUES (
    'Cochinita pibil',
    '[
        {"section": null, "order": 1, "instruction": "Coloque en el vaso el ajo, el orégano, el achiote, la pimienta, el comino en polvo, el vinagre, el jugo de naranja, la cebolla y la sal, licue 30 seg/vel 8. Transfiera a un tazón y reserve."},
        {"section": null, "order": 2, "instruction": "Coloque el tazón con el marinado sobre la tapa del vaso y pese la carne de cerdo en cubos. Mezcle y deje reposar en refrigeración por 3 horas."},
        {"section": null, "order": 3, "instruction": "Coloque en el vaso el aceite, la manteca de cerdo y la carne con la marinada, coloque el cestillo sobre la tapa en lugar del cubilete y cocine 40 min/100°C//vel  ."},
        {"section": null, "order": 4, "instruction": "Retire el cestillo y coloque el cubilete en su posición, deshebre 5 seg//vel 4.5 y sirva caliente."}
    ]'::jsonb,
    '', '', 'fácil', 15, 240, '6 porciones',
    'tazón',
    '{"inf. nutricional": "por 1 porción", "calorías": "7 kcal", "proteína": "29.5 g", "carbohidratos": "7.6 g", "grasa": "42.3 g", "grasa saturada": "14.8 g", "fibra": "1.5 g", "sodio": "872.6 mg"}'::jsonb,
    'Sirva la cochinita pibil con cebollitas preparadas usando 3 chiles habaneros cortados en juliana, 1 cucharada de orégano seco, 1 diente de ajo picado, 120 g de vinagre blanco, el jugo de 2 limones, 200 g de cebolla morada en juliana y sal al gusto. Deje marinar la salsa por lo menos 30 minutos antes de servir.'
);
INSERT INTO recipes (
    name, steps, display_picture_url, difficulty, prep_time, total_time, portions,
    useful_items, nutritional_value, tips_and_tricks
) VALUES (
    'Adobo con carne',
    '[
        {"section": null, "order": 1, "instruction": "Coloque en el vaso los chiles secos, el comino en polvo, el orégano, la pimienta, los clavos de olor, el diente de ajo y la cebolla, licue 30 seg/vel 10."},
        {"section": null, "order": 2, "instruction": "Añada el jitomate, los cubos de caldo, el aceite y el vinagre de manzana, licue 1 min/vel 8. Baje los restos de las paredes del vaso con la espátula."},
        {"section": null, "order": 3, "instruction": "Añada el agua y cocine 15 min/100°C/vel 1."},
        {"section": null, "order": 4, "instruction": "Añada el lomo de cerdo en cubos, la sal, coloque el cestillo sobre la tapa en lugar del cubilete y cocine 30 min/Varoma//vel ."},
        {"section": null, "order": 5, "instruction": "Transfiera a un tazón, coloque la mitad de la carne cocida en el vaso, deshebre 4 seg//vel 4.5. Transfiera a un tazón con la salsa. Coloque el resto de la carne cocida en trozos en el vaso y deshebre 4 seg//vel 4.5. Retire del vaso y reserve en el tazón con el resto del adobo, mezcle bien con la espátula y sirva caliente."}
    ]'::jsonb,
    '', '', 'fácil', 10, 50, '6 porciones',
    '',
    '{"inf. nutricional": "por 1 porción", "calorías": "3 kcal", "proteína": "35.5 g", "carbohidratos": "10.6 g", "grasa": "26.4 g", "grasa saturada": "8 g", "fibra": "3.9 g", "sodio": "893.3 mg"}'::jsonb,
    'Sirva con arroz y tortillas de maíz calientes. Sustituya la carne de cerdo por carne de res en cubos. Si desea preparar el adobo con pechuga de pollo, cocine en el paso 4 por 20 minutos.'
);

INSERT INTO recipes (
    name, steps, display_picture_url, difficulty, prep_time, total_time, portions,
    useful_items, nutritional_value, tips_and_tricks
) VALUES (
    'Lasaña boloñesa',
    '[
        {"section": "Salsa Boloñesa", "order": 1, "instruction": "Coloque en el vaso la zanahoria, el pimiento rojo, la rama de apio, el diente de ajo, los champiñones y el jitomate, pique 5 seg/vel 5. Transfiera a un tazón y reserve."},
        {"section": "Salsa Boloñesa", "order": 2, "instruction": "Coloque en el vaso la cebolla y el aceite, sofría Alta temperatura ."},
        {"section": "Salsa Boloñesa", "order": 3, "instruction": "Añada la carne molida de res, la sal y la pimienta molida, sofría Alta temperatura ."},
        {"section": "Salsa Boloñesa", "order": 4, "instruction": "Añada las verduras picadas reservadas, el orégano seco, la hoja de laurel seca y los cubos de caldo, cocine 20 min/100°C//vel 1. Transfiera a un tazón y reserve. Lave el vaso."},
        {"section": "Salsa Bechamel", "order": 5, "instruction": "Coloque en el vaso la leche, la mantequilla, la harina, la sal y la nuez moscada, cocine 12 min/100°C/vel 3."},
        {"section": "Preparación de la lasaña", "order": 6, "instruction": "Precaliente el horno a 180°C. Engrase un refractario y reserve."},
        {"section": "Preparación de la lasaña", "order": 7, "instruction": "Cubra el fondo del refractario con una capa delgada de la salsa Boloñesa. Coloque una capa de placas de pasta para lasaña sobre la salsa, cubra nuevamente con otra capa de salsa Boloñesa, espolvoree con queso parmesano y cubra con una capa de salsa bechamel. Repita los pasos hasta que se terminen los ingredientes. Termine con una capa de salsa bechamel y espolvoree con queso parmesano."},
        {"section": "Preparación de la lasaña", "order": 8, "instruction": "Hornee por 40-45 minutos (180°C) o hasta que la superficie esté dorada. Deje reposar por 10 minutos antes de servir."}
    ]'::jsonb,
    '', '', 'medio', 40, 150, '6 porciones',
    'horno, molde para hornear (30 x 24 x 6 cm), tazón',
    '{"inf. nutricional": "por 1 porción", "calorías": "994 kcal", "proteína": "50 g", "carbohidratos": "53 g", "grasa": "64 g", "fibra": "4 g"}'::jsonb,
    'Es un buen platillo para recibir invitados ya que puede prepararse con anticipación y hornearse al momento de la llegada de los invitados. Usualmente las placas de lasaña no necesitan precocción antes de hornear (revise el paquete y sus instrucciones). Si prefiere cocinar la pasta de forma tradicional, precocine las placas de lasaña en una olla grande con agua hirviendo con sal (aprox. 1 cda de sal por litro de agua) por aprox. 5 minutos. Escurra en el recipiente Varoma y elimine la humedad dejando secar sobre un papel de cocina absorbente. Prepare la pasta mientras cocina la salsa bechamel. Si cuenta con sobrantes de lasaña, puede congelarlos. Para preparar su propia carne molida, coloque los trozos de carne sin nervios (3 cm) en el congelador por 30 minutos. Coloque los trozos de carne semicongelados en el vaso y muela 10-15 seg/vel 6. En lugar de placas de lasaña seca, use pasta fresca.'
);

INSERT INTO recipes (
    name, steps, display_picture_url, difficulty, prep_time, total_time, portions,
    useful_items, nutritional_value, tips_and_tricks
) VALUES (
    'Fideo seco en salsa de chiles',
    '[
        {"section": null, "order": 1, "instruction": "Coloque en el vaso el queso cotija y ralle 5 seg/vel 5. Transfiera a un tazón y reserve."},
        {"section": null, "order": 2, "instruction": "Coloque en el vaso el aceite, la cebolla, el ajo, los jitomates, el chile morita, el chile cascabel y la sal, sofría Alta temperatura . Luego, inice Licuar /1 min."},
        {"section": null, "order": 3, "instruction": "Añada el agua y los fideos fritos, cocine 15 min/110°C//vel  sustituyendo el cubilete por el cestillo."},
        {"section": null, "order": 4, "instruction": "Sirva caliente con crema, aguacate y el queso cotija rallado."}
    ]'::jsonb,
    '', '', 'fácil', 5, 35, '5 porciones',
    'tazón',
    '{"inf. nutricional": "por 1 porción", "calorías": "289 kcal", "proteína": "9 g", "carbohidratos": "37 g", "grasa": "12 g", "fibra": "2 g"}'::jsonb,
    'Fideos tostados en horno: Precaliente el horno a 200°C. Coloque el fideo sobre una charola para horno y hornee por 10-15 minutos (200°C) o hasta que se hayan dorado, moviendo ocasionalmente para obtener un dorado uniforme, deje enfriar por completo y guarde los fideos tostados en un recipiente hermético. Fideos tostados en sartén: Coloque una sartén a fuego medio alto y tueste sin aceite el fideo moviendo constantemente para obtener un dorado uniforme. Transfiera a una charola para dejar enfriar por completo y guarde los fideos tostados en un recipiente hermético. Si desea puede añadir un poco de aceite para dorar el fideo. Utilice fideo No. 2 para que la consistencia sea la adecuada. Si utiliza fideos finos podría batirse.'
);

INSERT INTO recipes (
    name, steps, display_picture_url, difficulty, prep_time, total_time, portions,
    useful_items, nutritional_value, tips_and_tricks
) VALUES (
    'Espagueti carbonara',
    '[
        {"section": null, "order": 1, "instruction": "Coloque en el vaso el queso parmesano y el queso pecorino, ralle 10 seg/vel 10. Transfiera a un tazón y reserve."},
        {"section": null, "order": 2, "instruction": "Coloque en el vaso el echalot y pique 3 seg/vel 5. Baje los restos de las paredes del vaso con la espátula."},
        {"section": null, "order": 3, "instruction": "Añada los cubos de tocino y el aceite de oliva extra virgen, sofría 5 min/120°C/vel 1. Transfiera a un tazón grande para servir y mantenga caliente."},
        {"section": null, "order": 4, "instruction": "Coloque en el vaso el agua y ½ cdita de la sal, hierva 10 min/100°C/vel 1."},
        {"section": null, "order": 5, "instruction": "Añada el spaghetti a través del orificio de la tapa al vaso, sin colocar el cubilete, cocine el tiempo indicado en el empaque/100°C//vel 1 o hasta que esté al dente. Escurra la pasta en el recipiente Varoma y transfiera al tazón con el tocino. Mezcle bien y mantenga caliente."},
        {"section": null, "order": 6, "instruction": "Antes de que la pasta se enfríe, coloque en el vaso los huevos, la yema de huevo, el queso rallado reservado, ¼ cdita de sal y la pimienta, mezcle 15 seg/vel 4. Añada la mezcla de huevo al tazón con la pasta y el tocino. Mezcle bien con la espátula y sirva inmediatamente."}
    ]'::jsonb,
    '', '', 'fácil', 20, 40, '4 porciones',
    '',
    '{"inf. nutricional": "por 1 porción", "calorías": "604 kcal", "proteína": "27 g", "carbohidratos": "63 g", "grasa": "27 g", "fibra": "5 g"}'::jsonb,
    'Si se forman burbujas en la tapa del vaso mientras se cuece la pasta, añada 1 cdita de aceite o de mantequilla al agua de cocción. La pasta que se cocina al dente es suave pero firme en el centro al morderla. La temperatura de la pasta cocida cocerá parcialmente y espesará el huevo, así que es importante que la pasta esté todavía caliente cuando se le añada la mezcla de huevo al tazón.'
);

INSERT INTO recipes (
    name, steps, display_picture_url, difficulty, prep_time, total_time, portions,
    useful_items, nutritional_value, tips_and_tricks
) VALUES (
    'Arroz negro cremoso con calamares',
    '[
        {"section": null, "order": 1, "instruction": "Ponga en el vaso los dientes de ajo, la cebolla y el aceite y trocee 4 seg/vel 5. Sofría 5 min/120°C/vel 1."},
        {"section": null, "order": 2, "instruction": "Incorpore los calamares y rehogue 8 min/120°C/vel ."},
        {"section": null, "order": 3, "instruction": "Añada el tomate y el arroz y rehogue 3 min/120°C/vel ."},
        {"section": null, "order": 4, "instruction": "Agregue el caldo de pescado y programe 4 min/100°C//vel ."},
        {"section": null, "order": 5, "instruction": "Añada la tinta de calamar y la sal y programe 10 min/100°C//vel . Vierta en una fuente, deje reposar durante 3-5 minutos y sirva inmediatamente."}
    ]'::jsonb,
    '', '', 'fácil', 15, 40, '4 raciones',
    '',
    '{"inf. nutricional": "por 1 ración", "calorías": "449 kcal", "proteína": "21.9 g", "carbohidratos": "41.8 g", "grasa": "21.8 g", "fibra": "1.5 g"}'::jsonb,
    ''
);

INSERT INTO recipes (
    name, steps, display_picture_url, difficulty, prep_time, total_time, portions,
    useful_items, nutritional_value, tips_and_tricks
) VALUES (
    'Arroz blanco con verduras',
    '[
        {"section": null, "order": 1, "instruction": "Coloque la zanahoria en el vaso, pique 2 seg/vel 5, transfiera a un tazón y reserve."},
        {"section": null, "order": 2, "instruction": "Coloque en el vaso la cebolla, los dientes de ajo y el aceite, pique 5 seg/vel 5 y sofría 4 min/120°C/vel 1."},
        {"section": null, "order": 3, "instruction": "Añada el agua y la sal, licue 30 seg/vel 7."},
        {"section": null, "order": 4, "instruction": "Coloque el cestillo dentro del vaso, añada el arroz, la zanahoria picada reservada, los chícharos y el cilantro en el cestillo, mezcle con la espátula, cocine 27 min/Varoma/vel 4"},
        {"section": null, "order": 5, "instruction": "Retire el cestillo con la muesca de la espátula, vierta el arroz en un refractario, revuelva con la espátula para que quede suelto y sirva caliente."}
    ]'::jsonb,
    '', '', 'fácil', 10, 40, '6 porciones',
    'refractario',
    '{"inf. nutricional": "por 1 porción", "calorías": "2 kcal", "proteína": "3.9 g", "carbohidratos": "37.9 g", "grasa": "3.9 g", "grasa saturada": "0.4 g", "fibra": "2 g", "sodio": "1185.6 mg"}'::jsonb,
    ''
);

INSERT INTO recipes (
    name, steps, display_picture_url, difficulty, prep_time, total_time, portions,
    useful_items, nutritional_value, tips_and_tricks
) VALUES (
    'Crema de verduras',
    '[
        {"section": null, "order": 1, "instruction": "Coloque en el vaso la papa, el jitomate, la cebolla, el diente de ajo, la mezcla de verduras, el perejil, la sal, la pimienta molida y el agua, cocine 25 min/120°C/vel 1."},
        {"section": null, "order": 2, "instruction": "Añada la mantequilla y licue 1 min/vel 5-10, aumentando progresivamente la velocidad . Sirva caliente."}
    ]'::jsonb,
    '', '', 'fácil', 15, 35, '6 porciones',
    '',
    '{"inf. nutricional": "por 1 porción", "calorías": "9 kcal", "proteína": "3.2 g", "carbohidratos": "17.4 g", "grasa": "3 g", "grasa saturada": "1.8 g", "fibra": "3.7 g", "sodio": "346.4 mg"}'::jsonb,
    'Antes del paso 1, puede sofreír la cebolla y ajo en 20 g de aceite. Coloque la cebolla, ajo y aceite de oliva en el vaso, pique 5 seg/vel 7 y sofría 3 min/120°C/vel 1. Proceda como se indica en la receta y omita la mantequilla en el paso 2.'
);

INSERT INTO recipes (
    name, steps, display_picture_url, difficulty, prep_time, total_time, portions,
    useful_items, nutritional_value, tips_and_tricks
) VALUES (
    'Crema de espárragos y queso Brie',
    '[
        {"section": null, "order": 1, "instruction": "Coloque en el vaso 20 g de mantequilla, separe las puntas de los espárragos y añádalas al vaso, sofría 3 min/100°C/vel 1. Retire del vaso y reserve."},
        {"section": null, "order": 2, "instruction": "Coloque en el vaso el resto de la mantequilla, los espárragos y sofría 6 min/120°C/vel 1."},
        {"section": null, "order": 3, "instruction": "Añada la harina y cocine 2 min/100°C/vel 2."},
        {"section": null, "order": 4, "instruction": "Añada el caldo de pollo, el vino y la crema y cocine 15 min/100°C/vel 1."},
        {"section": null, "order": 5, "instruction": "Añada el queso Brie, la sal, la pimienta y licue 1 min/vel 4-8, aumentando progresivamente la velocidad."},
        {"section": null, "order": 6, "instruction": "Sirva caliente con las puntas de los espárragos como decoración."}
    ]'::jsonb,
    '', '', 'fácil', 10, 30, '6 porciones',
    '',
    '{"inf. nutricional": "por 1 porción", "calorías": "297 kcal", "proteína": "8 g", "carbohidratos": "11 g", "grasa": "22 g", "fibra": "1 g"}'::jsonb,
    ''
);

INSERT INTO recipes (
    name, steps, display_picture_url, difficulty, prep_time, total_time, portions,
    useful_items, nutritional_value, tips_and_tricks
) VALUES (
    'Margarita de sandía y mango',
    '[
        {"section": null, "order": 1, "instruction": "Coloque en el vaso el jugo de limón, el mango, la sandía, el azúcar, el tequila, la sal y el hielo, licue 30 seg/vel 10."},
        {"section": null, "order": 2, "instruction": "Corte el limón a la mitad y humedezca con jugo de limón las orillas de las copas de margarita."},
        {"section": null, "order": 3, "instruction": "Coloque chamoy en polvo en un plato extendido y escarche las orillas de las copas."},
        {"section": null, "order": 4, "instruction": "Sirva la margarita inmediatamente y disfrute."}
    ]'::jsonb,
    '', '', 'fácil', 5, 5, '6 vasos',
    'plato pequeño, copas',
    '{"inf. nutricional": "por 1 vaso", "calorías": "112 kcal", "proteína": "0 g", "carbohidratos": "0 g", "grasa": "0 g", "fibra": "1 g"}'::jsonb,
    ''
);

INSERT INTO recipes (
    name, steps, display_picture_url, difficulty, prep_time, total_time, portions,
    useful_items, nutritional_value, tips_and_tricks
) VALUES (
    'Limonada',
    '[
        {"section": null, "order": 1, "instruction": "Coloque en el vaso los limones, 500 g del agua y el azúcar. Coloque el cubilete en su posición y sujételo con la mano y exprima 2 seg/vel 10."},
        {"section": null, "order": 2, "instruction": "Añada los 500 g del agua restantes. Introduzca el cestillo, sujételo en su posición con la espátula y cuele la limonada en una jarra. Añada hielos y sirva inmediatamente."}
    ]'::jsonb,
    '', '', 'fácil', 5, 5, '6 vasos',
    '',
    '{"inf. nutricional": "por 1 vaso", "calorías": "76 kcal", "proteína": "0 g", "carbohidratos": "17 g", "grasa": "0 g", "fibra": "0 g"}'::jsonb,
    'Esta bebida refrescante es particularmente fácil de preparar en Thermomix y es muy popular en los paises donde se planta el limonero como Italia, España, Portugal y México. Use limones pequeños, ya que contienen más jugo y menos cáscara. Para una limonada más dulce, ajuste la cantidad de azúcar al gusto. Sustituya los limones por 2 naranjas pequeñas o 1 toronja, en cuartos.'
);

INSERT INTO recipes (
    name, steps, display_picture_url, difficulty, prep_time, total_time, portions,
    useful_items, nutritional_value, tips_and_tricks
) VALUES (
    'Horchata de semillas de melón',
    '[
        {"section": null, "order": 1, "instruction": "Coloque en el vaso las semillas de melón, el azúcar y 500 g de agua, licue 30 seg/vel 10."},
        {"section": null, "order": 2, "instruction": "Añada los 500 g de agua restantes y la canela en polvo, licue 1 min/vel 5. Cuele con ayuda de un colador de malla fina y sirva con hielos."}
    ]'::jsonb,
    '', '', 'fácil', 5, 5, '6 vasos',
    'colador de malla fina',
    '{"inf. nutricional": "por 1 vaso", "calorías": "94 kcal", "proteína": "0 g", "carbohidratos": "25 g", "grasa": "0 g", "fibra": "0 g"}'::jsonb,
    ''
);

INSERT INTO recipes (
    name, steps, display_picture_url, difficulty, prep_time, total_time, portions,
    useful_items, nutritional_value, tips_and_tricks
) VALUES (
    'Detox verde',
    '[
        {"section": null, "order": 1, "instruction": "Coloque en el vaso el agua, la manzana, el kale, el pepino y el apio, licue 1 min 30 seg/vel 8. Sirva en dos vasos."}
    ]'::jsonb,
    '', '', 'fácil', 5, 10, '2 porciones',
    'vasos',
    '{"inf. nutricional": "por 1 porción", "calorías": "5 kcal", "proteína": "2.5 g", "carbohidratos": "40 g", "grasa": "0.5 g", "grasa saturada": "0 g", "fibra": "2.5 g", "sodio": "24 mg"}'::jsonb,
    'Sirva con hielos.'
);

INSERT INTO recipes (
    name, steps, display_picture_url, difficulty, prep_time, total_time, portions,
    useful_items, nutritional_value, tips_and_tricks
) VALUES (
    'Rajas con queso',
    '[
        {"section": null, "order": 1, "instruction": "Coloque en el vaso el queso chihuahua y ralle 8 seg/vel 6. Transfiera a un tazón y reserve."},
        {"section": null, "order": 2, "instruction": "Coloque en el vaso la cebolla y pique 5 seg/vel 5. Baje los restos de las paredes del vaso con la espátula."},
        {"section": null, "order": 3, "instruction": "Añada los granos de elote y el aceite, cocine 8 min/120°C/vel 1. Trasfiera a un tazón y reserve."},
        {"section": null, "order": 4, "instruction": "Coloque en el vaso el chile poblano y pique 3 seg/vel 4.5."},
        {"section": null, "order": 5, "instruction": "Añada el elote cocido, el queso rallado, la sal, la crema ácida y cocine 8 min/100°C//vel 1."},
        {"section": null, "order": 6, "instruction": "Sirva caliente."}
    ]'::jsonb,
    '', '', 'fácil', 5, 25, '4 porciones',
    '',
    '{"inf. nutricional": "por 1 porción", "calorías": "6 kcal", "proteína": "11.6 g", "carbohidratos": "18.4 g", "grasa": "23 g", "grasa saturada": "11.7 g", "fibra": "2.3 g", "sodio": "551 mg"}'::jsonb,
    ''
);

INSERT INTO recipes (
    name, steps, display_picture_url, difficulty, prep_time, total_time, portions,
    useful_items, nutritional_value, tips_and_tricks
) VALUES (
    'Broccolini crujiente con salsa de ajos',
    '[
        {"section": null, "order": 1, "instruction": "Ponga en el vaso el azúcar moreno y pulverice 10 seg/vel 10."},
        {"section": null, "order": 2, "instruction": "Agregue el ajo y el aceite y pique 3 seg/vel 7. Con la espátula, baje los ingredientes hacia el fondo del vaso y sofría 4 min/120°C/vel ."},
        {"section": null, "order": 3, "instruction": "Incorpore el broccolini y sofría 2 min/120°C//vel ."},
        {"section": null, "order": 4, "instruction": "Añada el vino blanco y, sin poner el cubilete, programe 3 min/Varoma//vel ."},
        {"section": null, "order": 5, "instruction": "Agregue la salsa de soja y, sin poner el cubilete, programe 5 min/Varoma//vel . Sirva inmediatamente."}
    ]'::jsonb,
    '', '', 'fácil', 15, 15, '4 raciones',
    '',
    '{"inf. nutricional": "por 1 ración", "calorías": "3 kcal", "proteína": "5.3 g", "carbohidratos": "9.3 g", "grasa": "10.5 g", "fibra": "4 g"}'::jsonb,
    'El broccolini es una verdura híbrida entre el brócoli y la col china.'
);

INSERT INTO recipes (
    name, steps, display_picture_url, difficulty, prep_time, total_time, portions,
    useful_items, nutritional_value, tips_and_tricks
) VALUES (
    'Salpicón de res',
    '[
        {"section": null, "order": 1, "instruction": "Coloque en el vaso la lechuga romana y 1200 g de agua, pique 4 seg//vel 4. Transfiera a un tazón y desinfecte. Escurra el agua, coloque la lechuga en un platón y reserve hasta su uso."},
        {"section": null, "order": 2, "instruction": "Coloque en el vaso el vinagre de vino blanco, el aceite de oliva extra virgen, la sal fina y la pimienta, mezcle 3 seg/vel 4. Transfiera a un recipiente y reserve."},
        {"section": null, "order": 3, "instruction": "Coloque en el vaso la falda de res, 1100 g de agua, la cebolla y el ajo, cocine 55 min/100°C//vel 1. Reserve el líquido de cocción para otra preparación."},
        {"section": null, "order": 4, "instruction": "Deshebre 5 seg//vel 5. Deje enfriar la carne."},
        {"section": null, "order": 5, "instruction": "Coloque en el platón de la lechuga, el jitomate, la cebolla morada, la carne y la mezcla de vinagre y aceite. Mezcle con ayuda de la espátula."},
        {"section": null, "order": 6, "instruction": "Sirva acompañado con rebanadas de aguacate y tostadas."}
    ]'::jsonb,
    '', '', 'fácil', 10, 60, '6 porciones',
    'tazón, platón para servir',
    '{"inf. nutricional": "por 1 porción", "calorías": "326 kcal", "proteína": "23 g", "carbohidratos": "24 g", "grasa": "16 g", "fibra": "2 g"}'::jsonb,
    ''
);

COMMIT;