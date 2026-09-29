export default function TestHome() {
  return (
    <div className="min-h-screen bg-blue-50 flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-blue-800 mb-4">
          🎉 ¡Frontend Público Funcionando!
        </h1>
        <p className="text-xl text-gray-600 mb-8">
          La página principal del directorio está cargando correctamente
        </p>
        <div className="bg-white p-6 rounded-lg shadow-lg max-w-md mx-auto">
          <h2 className="text-2xl font-semibold mb-4">Próximos pasos:</h2>
          <ul className="text-left space-y-2">
            <li>✅ Frontend público funcionando</li>
            <li>✅ Rutas configuradas</li>
            <li>🔄 Cargando empresas...</li>
          </ul>
        </div>
      </div>
    </div>
  );
}