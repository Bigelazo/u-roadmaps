import { NextResponse } from 'next/server';
import { query, initDatabase } from '@/lib/db';

const defaultNodes = [
  {
    id: '1',
    type: 'input',
    data: { label: 'CC3101: Matemáticas Discretas para la Computación' },
    position: { x: 50, y: 100 },
    style: { background: '#1e293b', color: '#f8fafc', border: '1px solid #475569', borderRadius: '8px' },
  },
  {
    id: '2',
    data: { label: 'CC3001: Algoritmos y Estructuras de Datos' },
    position: { x: 350, y: 100 },
    style: { background: '#1e293b', color: '#f8fafc', border: '1px solid #475569', borderRadius: '8px' },
  },
  {
    id: '3',
    data: { label: 'CC3002: Metodologías de Diseño y Programación' },
    position: { x: 50, y: 250 },
    style: { background: '#1e293b', color: '#f8fafc', border: '1px solid #475569', borderRadius: '8px' },
  },
  {
    id: '4',
    data: { label: 'CC4301: Bases de Datos (SQL)' },
    position: { x: 650, y: 100 },
    style: { background: '#1e293b', color: '#f8fafc', border: '1px solid #475569', borderRadius: '8px' },
  },
  {
    id: '5',
    data: { label: 'CC4401: Ingeniería de Software' },
    position: { x: 350, y: 250 },
    style: { background: '#1e293b', color: '#f8fafc', border: '1px solid #475569', borderRadius: '8px' },
  },
  {
    id: '6',
    type: 'output',
    data: { label: '🚀 CC5905: Memoria - ¡Hola Mundo!' },
    position: { x: 650, y: 250 },
    style: { background: '#2563eb', color: '#ffffff', border: '2px solid #60a5fa', borderRadius: '8px', fontWeight: 'bold' },
  },
];

const defaultEdges = [
  { id: 'e1-2', source: '1', target: '2', animated: true, style: { stroke: '#60a5fa' } },
  { id: 'e2-4', source: '2', target: '4', animated: true, style: { stroke: '#60a5fa' } },
  { id: 'e3-5', source: '3', target: '5', animated: true, style: { stroke: '#60a5fa' } },
  { id: 'e5-6', source: '5', target: '6', animated: true, style: { stroke: '#2563eb' } },
  { id: 'e4-6', source: '4', target: '6', animated: true, style: { stroke: '#2563eb' } },
];

export async function GET() {
  try {
    await initDatabase();
    const result = await query('SELECT * FROM roadmaps WHERE course_code = $1', ['CC-DCC']);
    if (result && result.rows.length > 0) {
      const dbRoadmap = result.rows[0];
      return NextResponse.json({
        title: dbRoadmap.title,
        description: dbRoadmap.description,
        nodes: dbRoadmap.nodes,
        edges: dbRoadmap.edges,
        source: 'database',
      });
    }
  } catch (error) {
    console.warn('Database not available or query failed, serving mock roadmap.', error.message);
  }

  return NextResponse.json({
    title: 'Malla Curricular Interactiva DCC',
    description: 'Propuesta de roadmap interactivo de asignaturas y especialización en Ciencias de la Computación.',
    nodes: defaultNodes,
    edges: defaultEdges,
    source: 'mock',
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { nodes, edges } = body;

    await initDatabase();
    
    await query(`
      INSERT INTO roadmaps (course_code, title, description, nodes, edges)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (course_code)
      DO UPDATE SET 
        nodes = EXCLUDED.nodes,
        edges = EXCLUDED.edges,
        updated_at = CURRENT_TIMESTAMP
    `, [
      'CC-DCC',
      'Malla Curricular Interactiva DCC',
      'Propuesta de roadmap interactivo de asignaturas y especialización en Ciencias de la Computación.',
      JSON.stringify(nodes),
      JSON.stringify(edges)
    ]);

    return NextResponse.json({ success: true, message: 'Roadmap guardado en la base de datos relacional.' });
  } catch (error) {
    console.error('Failed to save roadmap in database:', error);
    return NextResponse.json(
      { success: false, error: 'No se pudo guardar en la base de datos.', details: error.message },
      { status: 500 }
    );
  }
}
