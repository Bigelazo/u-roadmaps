'use client';

import React, { useState, useEffect, useCallback } from 'react';
import ReactFlow, {
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  Edge,
  Node,
} from 'reactflow';
import { Save, Plus, Database, Sparkles, AlertCircle } from 'lucide-react';

export default function RoadmapCanvas() {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dbStatus, setDbStatus] = useState<'mock' | 'database' | 'loading'>('loading');
  const [newNodeLabel, setNewNodeLabel] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');

  const fetchRoadmap = async () => {
    try {
      const response = await fetch('/api/roadmap');
      const data = await response.json();
      setNodes(data.nodes || []);
      setEdges(data.edges || []);
      setTitle(data.title || 'Malla Interactiva');
      setDescription(data.description || '');
      setDbStatus(data.source || 'mock');
    } catch (error) {
      console.error('Error fetching roadmap:', error);
      setDbStatus('mock');
    }
  };

  useEffect(() => {
    fetchRoadmap();
  }, []);

  const onConnect = useCallback(
    (params: Connection | Edge) => 
      setEdges((eds) => addEdge({ ...params, animated: true, style: { stroke: '#3b82f6' } }, eds)),
    [setEdges]
  );

  const addNode = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNodeLabel.trim()) return;

    const id = (nodes.length + 1).toString();
    const newNode: Node = {
      id,
      data: { label: newNodeLabel },
      position: { x: 200 + Math.random() * 200, y: 150 + Math.random() * 150 },
      style: { background: '#1e293b', color: '#f8fafc', border: '1px solid #475569', borderRadius: '8px' },
    };

    setNodes((nds) => [...nds, newNode]);
    setNewNodeLabel('');
  };

  const saveRoadmap = async () => {
    setIsSaving(true);
    setSaveMessage('');
    try {
      const response = await fetch('/api/roadmap', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ nodes, edges }),
      });
      const data = await response.json();
      if (data.success) {
        setSaveMessage('¡Guardado con éxito en PostgreSQL!');
        setDbStatus('database');
      } else {
        setSaveMessage('Guardado de manera local (DB no conectada)');
      }
    } catch (error) {
      console.error('Error saving roadmap:', error);
      setSaveMessage('Error de red. Guardado localmente.');
    } finally {
      setIsSaving(false);
      setTimeout(() => setSaveMessage(''), 4000);
    }
  };

  return (
    <div className="flex flex-col md:flex-row h-[70vh] w-full rounded-2xl border border-slate-800 bg-slate-950 overflow-hidden shadow-2xl">
      {/* Sidebar de administración */}
      <div className="w-full md:w-80 border-b md:border-b-0 md:border-r border-slate-800 p-6 flex flex-col justify-between bg-slate-900 bg-opacity-40 backdrop-blur-md">
        <div className="space-y-6">
          <div>
            <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-blue-500" />
              Gestor de Ruta DCC
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Agrega asignaturas, arrastra y conéctalas con el mouse para diseñar la estructura curricular.
            </p>
          </div>

          {/* Conexión de Base de Datos */}
          <div className="p-3 rounded-lg border border-slate-800 bg-slate-950 flex items-center gap-2 animate-fadeIn">
            <Database className={`h-4 w-4 ${dbStatus === 'database' ? 'text-green-500' : 'text-amber-500'}`} />
            <div>
              <div className="text-xs font-semibold text-slate-300">
                Almacenamiento Relacional:
              </div>
              <div className="text-[10px] text-slate-400 font-mono">
                {dbStatus === 'database' ? 'PostgreSQL Activo 🐳' : 'Modo Simulador Local'}
              </div>
            </div>
          </div>

          {/* Formulario Agregar Nodo */}
          <form onSubmit={addNode} className="space-y-2">
            <label className="text-xs font-medium text-slate-300 block">Nueva Asignatura o Hito</label>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Ej: CC5002: Redes"
                value={newNodeLabel}
                onChange={(e) => setNewNodeLabel(e.target.value)}
                className="flex-1 px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
              />
              <button
                type="submit"
                className="p-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white transition-colors"
                title="Agregar nodo"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
          </form>
        </div>

        {/* Guardar cambios */}
        <div className="space-y-3 mt-6">
          {saveMessage && (
            <div className="p-2 text-center rounded-lg bg-blue-950 border border-blue-800 text-xs text-blue-300 flex items-center justify-center gap-1 animate-pulse">
              <AlertCircle className="h-3.5 w-3.5" />
              {saveMessage}
            </div>
          )}
          <button
            onClick={saveRoadmap}
            disabled={isSaving}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 text-white font-medium text-sm transition-colors shadow-lg shadow-blue-900/20"
          >
            <Save className="h-4 w-4" />
            {isSaving ? 'Guardando...' : 'Guardar Progreso'}
          </button>
        </div>
      </div>

      {/* Canvas de React Flow */}
      <div className="flex-1 h-full relative">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          fitView
          attributionPosition="bottom-right"
        >
          <Controls />
          <MiniMap 
            nodeColor={(node) => {
              if (node.id === '6') return '#2563eb';
              return '#475569';
            }} 
            maskColor="rgba(15, 23, 42, 0.7)"
            style={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }}
          />
          <Background color="#334155" gap={16} size={1} />
        </ReactFlow>
      </div>
    </div>
  );
}
