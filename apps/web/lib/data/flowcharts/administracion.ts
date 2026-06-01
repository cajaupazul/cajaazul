export type CourseCategory = 
  | 'nivelacion'
  | 'economia'
  | 'finanzas'
  | 'marketing'
  | 'sello_up'
  | 'administracion'
  | 'contabilidad'
  | 'derecho';

export type CourseNode = {
  id: string;
  label: string;
  credits: number;
  cycle: number;
  category: CourseCategory;
};

export type CourseEdge = {
  source: string;
  target: string;
};

export const administracionNodes: CourseNode[] = [
  // Ciclo 0
  { id: 'niv_mat', label: 'Nivelación en Matemáticas', credits: 0, cycle: 0, category: 'nivelacion' },
  { id: 'niv_inf', label: 'Nivelación en Informática', credits: 0, cycle: 0, category: 'nivelacion' },
  { id: 'niv_len', label: 'Nivelación en Lenguaje', credits: 0, cycle: 0, category: 'nivelacion' },

  // Ciclo 1
  { id: 'fund_emp', label: 'Fundamentos de las Ciencias Empresariales', credits: 4, cycle: 1, category: 'administracion' },
  { id: 'mat_1', label: 'Matemáticas I', credits: 5, cycle: 1, category: 'finanzas' },
  { id: 'eco_1', label: 'Economía General I', credits: 5, cycle: 1, category: 'finanzas' },
  { id: 'len_1', label: 'Lenguaje I', credits: 4, cycle: 1, category: 'sello_up' },

  // Ciclo 2
  { id: 'mat_neg', label: 'Matemáticas para los Negocios', credits: 4, cycle: 2, category: 'economia' },
  { id: 'eco_2', label: 'Economía General II', credits: 5, cycle: 2, category: 'finanzas' },
  { id: 'fund_cont', label: 'Fundamentos de Contabilidad', credits: 4, cycle: 2, category: 'sello_up' },
  { id: 'len_2', label: 'Lenguaje II', credits: 4, cycle: 2, category: 'sello_up' },
  { id: 'blq_soc', label: 'Bloque Ciencias Sociales', credits: 4, cycle: 2, category: 'sello_up' },

  // Ciclo 3
  { id: 'est_1', label: 'Estadística I', credits: 4, cycle: 3, category: 'economia' },
  { id: 'cont_fin_int', label: 'Contabilidad Financiera Intermedia', credits: 5, cycle: 3, category: 'contabilidad' },
  { id: 'der_civ_com', label: 'Derecho Civil y Comercial', credits: 3, cycle: 3, category: 'derecho' },
  { id: 'blq_pen_cri', label: 'Bloque Pensamiento Crítico', credits: 4, cycle: 3, category: 'sello_up' },
  { id: 'blq_des_per', label: 'Bloque Desarrollo Personal', credits: 4, cycle: 3, category: 'sello_up' },

  // Ciclo 4
  { id: 'dis_org_est', label: 'Diseño Organizacional y Estrategia', credits: 4, cycle: 4, category: 'administracion' },
  { id: 'mkt_est', label: 'Marketing Estratégico', credits: 4, cycle: 4, category: 'marketing' },
  { id: 'ana_dat_neg', label: 'Analítica de Datos para los Negocios', credits: 3, cycle: 4, category: 'administracion' },
  { id: 'fund_fin', label: 'Fundamentos de Finanzas', credits: 4, cycle: 4, category: 'finanzas' },
  { id: 'der_lab_tri', label: 'Derecho Laboral y Tributario', credits: 3, cycle: 4, category: 'derecho' },

  // Ciclo 5
  { id: 'ges_cam_cul', label: 'Gestión del Cambio y Transformación Cultural', credits: 4, cycle: 5, category: 'administracion' },
  { id: 'inv_mer', label: 'Investigación de Mercados', credits: 4, cycle: 5, category: 'marketing' },
  { id: 'met_cua_ges', label: 'Métodos Cuantitativos para la Gestión', credits: 4, cycle: 5, category: 'administracion' },
  { id: 'ana_mul_neg', label: 'Análisis Multivariado para los Negocios', credits: 4, cycle: 5, category: 'administracion' },
  { id: 'con_tom_dec', label: 'Contabilidad para la Toma de Decisiones', credits: 5, cycle: 5, category: 'contabilidad' },

  // Ciclo 6
  { id: 'ges_per', label: 'Gestión de Personas', credits: 4, cycle: 6, category: 'administracion' },
  { id: 'inn_ges_neg_dig', label: 'Innovación y Gestión en Negocios Digitales', credits: 3, cycle: 6, category: 'administracion' },
  { id: 'ges_ope_org', label: 'Gestión de Operaciones en las Organizaciones', credits: 4, cycle: 6, category: 'administracion' },
  { id: 'fin_cor_1', label: 'Finanzas Corporativas I', credits: 5, cycle: 6, category: 'finanzas' },
  { id: 'inv_aca', label: 'Investigación Académica', credits: 3, cycle: 6, category: 'sello_up' },

  // Ciclo 7
  { id: 'cre_val_tom_dec', label: 'Creación de Valor y Toma de Decisiones', credits: 3, cycle: 7, category: 'administracion' },
  { id: 'ges_com_int', label: 'Gestión del Comercio Internacional', credits: 4, cycle: 7, category: 'sello_up' }, // Morado, pero pondremos sello up para no crear nueva cate
  { id: 'sis_inf_ana_dat', label: 'Sistemas de Información y Análisis de Datos', credits: 3, cycle: 7, category: 'administracion' },
  { id: 'ges_cad_sum', label: 'Gestión de la Cadena de Suministros', credits: 4, cycle: 7, category: 'administracion' },
  { id: 'eva_fin_org', label: 'Evaluación Financiera de las Organizaciones', credits: 5, cycle: 7, category: 'contabilidad' },

  // Ciclo 8
  { id: 'dir_est', label: 'Dirección Estratégica', credits: 4, cycle: 8, category: 'administracion' },
  { id: 'ges_int_emp', label: 'Gestión Internacional de las Empresas', credits: 4, cycle: 8, category: 'sello_up' },
  { id: 'bus_agi', label: 'Business Agility', credits: 3, cycle: 8, category: 'administracion' },
  { id: 'ges_sos_soc_amb', label: 'Gest. de la Sostenibilidad Social y Ambiental', credits: 4, cycle: 8, category: 'administracion' },
  { id: 'blq_pro_soc', label: 'Bloque de Procesos Sociales', credits: 4, cycle: 8, category: 'sello_up' },

  // Ciclo 9
  { id: 'inv_apl_neg', label: 'Investigación Aplicada a los Negocios', credits: 4, cycle: 9, category: 'administracion' },
  { id: 'eti', label: 'Ética', credits: 4, cycle: 9, category: 'sello_up' },
  { id: 'blq_int_que_cie', label: 'Bloque Introducción al Quehacer Científico', credits: 4, cycle: 9, category: 'sello_up' },
  { id: 'blq_pen_cri_2', label: 'Bloque Pensamiento Crítico', credits: 4, cycle: 9, category: 'sello_up' },

  // Ciclo 10
  { id: 'pro_emp', label: 'Proyecto Empresarial', credits: 5, cycle: 10, category: 'administracion' },
  { id: 'pro_soc', label: 'Proyección Social', credits: 4, cycle: 10, category: 'sello_up' },
  { id: 'blq_pro_soc_2', label: 'Bloque de Procesos Sociales', credits: 4, cycle: 10, category: 'sello_up' },
];

export const administracionEdges: CourseEdge[] = [
  // De Nivelación a Ciclo 1
  { source: 'niv_mat', target: 'mat_1' },
  { source: 'niv_mat', target: 'eco_1' },
  { source: 'niv_len', target: 'len_1' },

  // De Ciclo 1 a Ciclo 2
  { source: 'mat_1', target: 'mat_neg' },
  { source: 'mat_1', target: 'eco_2' },
  { source: 'mat_1', target: 'fund_cont' },
  { source: 'niv_inf', target: 'mat_neg' }, 
  { source: 'eco_1', target: 'eco_2' },
  { source: 'len_1', target: 'len_2' },
  { source: 'len_1', target: 'blq_soc' },
  { source: 'len_1', target: 'blq_des_per' }, // Salto a Ciclo 3

  // De Ciclo 1, 2 a Ciclo 3
  { source: 'niv_inf', target: 'est_1' },
  { source: 'mat_1', target: 'est_1' },
  { source: 'fund_cont', target: 'cont_fin_int' },
  { source: 'fund_emp', target: 'der_civ_com' },
  { source: 'len_2', target: 'blq_pen_cri' },

  // De Ciclo 1, 2, 3 a Ciclo 4
  { source: 'fund_emp', target: 'dis_org_est' },
  { source: 'fund_emp', target: 'mkt_est' },
  { source: 'eco_2', target: 'mkt_est' },
  { source: 'est_1', target: 'ana_dat_neg' },
  { source: 'cont_fin_int', target: 'fund_fin' },
  { source: 'der_civ_com', target: 'der_lab_tri' },

  // Ciclo 4 -> Ciclo 5
  { source: 'dis_org_est', target: 'ges_cam_cul' },
  { source: 'mkt_est', target: 'inv_mer' },
  { source: 'ana_dat_neg', target: 'inv_mer' },
  { source: 'est_1', target: 'met_cua_ges' }, // Salto
  { source: 'ana_dat_neg', target: 'ana_mul_neg' },
  { source: 'cont_fin_int', target: 'con_tom_dec' }, // Salto

  // Ciclo 5 -> Ciclo 6
  { source: 'ges_cam_cul', target: 'ges_per' },
  { source: 'inv_mer', target: 'inn_ges_neg_dig' },
  { source: 'met_cua_ges', target: 'ges_ope_org' },
  { source: 'fund_fin', target: 'fin_cor_1' }, // Salto
  { source: 'ana_mul_neg', target: 'fin_cor_1' },
  { source: 'eco_2', target: 'fin_cor_1' }, // Salto largo
  { source: 'len_2', target: 'inv_aca' }, // Salto largo
  { source: 'blq_des_per', target: 'inv_aca' }, // Salto

  // Ciclo 6 -> Ciclo 7
  { source: 'ges_per', target: 'cre_val_tom_dec' },
  { source: 'fin_cor_1', target: 'cre_val_tom_dec' },
  { source: 'inn_ges_neg_dig', target: 'ges_com_int' },
  { source: 'ges_ope_org', target: 'sis_inf_ana_dat' },
  { source: 'fin_cor_1', target: 'sis_inf_ana_dat' },
  { source: 'ges_ope_org', target: 'ges_cad_sum' },
  { source: 'fin_cor_1', target: 'eva_fin_org' },

  // Ciclo 7 -> Ciclo 8
  { source: 'cre_val_tom_dec', target: 'dir_est' },
  { source: 'ges_com_int', target: 'ges_int_emp' },
  { source: 'sis_inf_ana_dat', target: 'bus_agi' },
  { source: 'ges_cad_sum', target: 'ges_sos_soc_amb' },
  { source: 'inv_aca', target: 'blq_pro_soc' }, // Salto

  // Ciclo 8 -> Ciclo 9
  { source: 'inv_aca', target: 'inv_apl_neg' }, // Salto
  { source: 'blq_pen_cri', target: 'eti' }, // Salto largo
  { source: 'blq_soc', target: 'blq_int_que_cie' }, // Salto larguísimo
  { source: 'blq_des_per', target: 'blq_pen_cri_2' }, // Salto larguísimo

  // Ciclo 9 -> Ciclo 10
  { source: 'dir_est', target: 'pro_emp' }, // Salto
  { source: 'inv_apl_neg', target: 'pro_emp' },
  { source: 'eti', target: 'pro_soc' },
  { source: 'blq_int_que_cie', target: 'blq_pro_soc_2' },
];
