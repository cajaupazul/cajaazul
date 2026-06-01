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
  { id: 'ana_dat_neg', label: 'Analítica de Datos para los Negocios', credits: 3, cycle: 4, category: 'administracion' },
  { id: 'mkt_est', label: 'Marketing Estratégico', credits: 4, cycle: 4, category: 'marketing' },
  { id: 'fund_fin', label: 'Fundamentos de Finanzas', credits: 4, cycle: 4, category: 'finanzas' },
  { id: 'der_lab_tri', label: 'Derecho Laboral y Tributario', credits: 3, cycle: 4, category: 'derecho' },
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
  { source: 'est_1', target: 'ana_dat_neg' },
  { source: 'fund_emp', target: 'mkt_est' },
  { source: 'cont_fin_int', target: 'fund_fin' },
  { source: 'der_civ_com', target: 'der_lab_tri' },
];
