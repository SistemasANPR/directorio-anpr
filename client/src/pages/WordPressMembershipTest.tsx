import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, User, Shield, Calendar, Clock, AlertCircle, CheckCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

// Función helper para obtener información sobre el estado de caducidad
const getExpirationInfo = (date: string) => {
  const expirationDate = new Date(date);
  const today = new Date();
  const diffTime = expirationDate.getTime() - today.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  
  let status = 'active';
  let color = 'green';
  let message = '';
  
  if (diffDays < 0) {
    status = 'expired';
    color = 'red';
    message = `Expiró hace ${Math.abs(diffDays)} día${Math.abs(diffDays) !== 1 ? 's' : ''}`;
  } else if (diffDays === 0) {
    status = 'expires-today';
    color = 'red';
    message = 'Expira hoy';
  } else if (diffDays <= 30) {
    status = 'expiring-soon';
    color = 'orange';
    message = `Expira en ${diffDays} día${diffDays !== 1 ? 's' : ''}`;
  } else {
    status = 'active';
    color = 'green';
    message = `Activa - ${diffDays} día${diffDays !== 1 ? 's' : ''} restantes`;
  }
  
  return { status, color, message, days: diffDays };
};

export default function WordPressMembershipTest() {
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [testUserId, setTestUserId] = useState<string>("");
  const [searchUsername, setSearchUsername] = useState<string>("luciaenriquez_sedema");
  const [showAllProducts, setShowAllProducts] = useState<boolean>(false);
  const [showSpecificSearch, setShowSpecificSearch] = useState<boolean>(false);
  const { toast } = useToast();

  // Obtener lista de usuarios de WordPress
  const { data: wpUsers, isLoading: wpUsersLoading } = useQuery({
    queryKey: ["/api/wordpress-users"],
    staleTime: 5 * 60 * 1000, // Cache por 5 minutos
  });

  // Obtener información de membresía del usuario seleccionado
  const { 
    data: membershipData, 
    isLoading: membershipLoading, 
    error: membershipError,
    refetch: refetchMembership 
  } = useQuery({
    queryKey: [`/api/wordpress-user-membership/${testUserId}`],
    enabled: !!testUserId,
    staleTime: 30 * 1000, // Cache por 30 segundos
  });

  // Obtener información de membresía por username
  const { 
    data: usernameMembershipData, 
    isLoading: usernameMembershipLoading, 
    error: usernameMembershipError,
    refetch: refetchUsernameMembership 
  } = useQuery({
    queryKey: [`/api/find-user-membership/${searchUsername}`],
    enabled: !!searchUsername && searchUsername.trim().length > 0,
    staleTime: 30 * 1000, // Cache por 30 segundos
  });

  // Obtener información completa de membresía con fechas de vencimiento
  const { 
    data: completeMembershipData, 
    isLoading: completeMembershipLoading, 
    error: completeMembershipError,
    refetch: refetchCompleteMembership 
  } = useQuery({
    queryKey: [`/api/memberpress-memberships/${usernameMembershipData?.user_id}`],
    enabled: !!usernameMembershipData?.user_id,
    staleTime: 30 * 1000, // Cache por 30 segundos
  });

  // Obtener todos los productos de MemberPress disponibles
  const { 
    data: allProductsData, 
    isLoading: allProductsLoading, 
    error: allProductsError,
    refetch: refetchAllProducts 
  } = useQuery({
    queryKey: ["/api/memberpress-products"],
    enabled: showAllProducts,
    staleTime: 2 * 60 * 1000, // Cache por 2 minutos
  });

  // Obtener información directa de la API de MemberPress para el usuario
  const { 
    data: directMembershipData, 
    isLoading: directMembershipLoading, 
    error: directMembershipError,
    refetch: refetchDirectMembership 
  } = useQuery({
    queryKey: [`/api/memberpress-direct/${usernameMembershipData?.user_id}`],
    enabled: !!usernameMembershipData?.user_id,
    staleTime: 30 * 1000, // Cache por 30 segundos
  });

  // Búsqueda específica de membresías (Profesional, Empresarial, Institucional)
  const { 
    data: specificSearchData, 
    isLoading: specificSearchLoading, 
    error: specificSearchError,
    refetch: refetchSpecificSearch 
  } = useQuery({
    queryKey: ["/api/memberpress-search-memberships"],
    enabled: showSpecificSearch,
    staleTime: 2 * 60 * 1000, // Cache por 2 minutos
  });

  const handleTestUser = () => {
    if (!selectedUserId) {
      toast({
        title: "Error",
        description: "Por favor selecciona un usuario para probar",
        variant: "destructive",
      });
      return;
    }
    setTestUserId(selectedUserId);
  };

  const renderPluginResponse = (pluginData: any, pluginKey: string) => {
    if (!pluginData) return null;
    
    const { plugin, status, data, error } = pluginData;
    const hasData = data && (Array.isArray(data) ? data.length > 0 : Object.keys(data).length > 0);
    
    return (
      <div key={pluginKey} className="border rounded-lg p-4">
        <div className="flex items-center justify-between mb-2">
          <h4 className="font-medium">{plugin}</h4>
          <Badge variant={status === 200 ? "default" : "destructive"}>
            {status || "Error"}
          </Badge>
        </div>
        
        {error ? (
          <div className="flex items-center text-sm text-red-600">
            <AlertCircle className="w-4 h-4 mr-1" />
            {error}
          </div>
        ) : hasData ? (
          <div className="flex items-center text-sm text-green-600">
            <CheckCircle className="w-4 h-4 mr-1" />
            Datos encontrados: {Array.isArray(data) ? `${data.length} registros` : "Objeto con datos"}
          </div>
        ) : (
          <div className="text-sm text-gray-500">
            Plugin responde pero sin datos de membresía
          </div>
        )}
        
        {hasData && (
          <details className="mt-2">
            <summary className="cursor-pointer text-sm text-blue-600">Ver datos</summary>
            <pre className="mt-2 text-xs bg-gray-100 p-2 rounded overflow-auto max-h-32">
              {JSON.stringify(data, null, 2)}
            </pre>
          </details>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Prueba de Membresías WordPress</h1>
            <p className="text-gray-600 mt-2">
              Herramienta para verificar si podemos obtener información de membresías desde WordPress
            </p>
          </div>
          <div className="flex gap-2">
            <Button 
              onClick={() => setShowAllProducts(!showAllProducts)}
              variant={showAllProducts ? "secondary" : "default"}
              size="sm"
            >
              <Search className="w-4 h-4 mr-2" />
              {showAllProducts ? "Ocultar Productos" : "Ver Todos los Productos"}
            </Button>
            <Button 
              onClick={() => setShowSpecificSearch(!showSpecificSearch)}
              variant={showSpecificSearch ? "secondary" : "outline"}
              size="sm"
            >
              <Search className="w-4 h-4 mr-2" />
              Buscar Membresías Específicas
            </Button>
          </div>
        </div>

        {/* Sección de todos los productos de MemberPress */}
        {showAllProducts && (
          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Productos de MemberPress Disponibles</CardTitle>
            </CardHeader>
            <CardContent>
              {allProductsLoading && (
                <div className="text-center py-8">
                  <Clock className="w-8 h-8 mx-auto animate-spin mb-4" />
                  <p className="text-gray-600">Consultando todos los productos de MemberPress...</p>
                </div>
              )}

              {allProductsError && (
                <div className="flex items-center text-red-600 bg-red-50 dark:bg-red-900/20 p-4 rounded">
                  <AlertCircle className="w-5 h-5 mr-2" />
                  <div>
                    <p className="font-medium">Error al consultar productos</p>
                    <p className="text-sm">{allProductsError.message}</p>
                  </div>
                </div>
              )}

              {allProductsData && (
                <div className="space-y-6">
                  {/* Resumen */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="text-center p-4 bg-green-50 dark:bg-green-900/20 rounded">
                      <p className="text-2xl font-bold text-green-600">{allProductsData.summary?.total_unique_products || 0}</p>
                      <p className="text-sm text-gray-600">Productos Únicos</p>
                    </div>
                    <div className="text-center p-4 bg-blue-50 dark:bg-blue-900/20 rounded">
                      <p className="text-2xl font-bold text-blue-600">{allProductsData.summary?.successful_endpoints || 0}</p>
                      <p className="text-sm text-gray-600">APIs Exitosas</p>
                    </div>
                    <div className="text-center p-4 bg-purple-50 dark:bg-purple-900/20 rounded">
                      <p className="text-2xl font-bold text-purple-600">{allProductsData.summary?.transaction_product_ids || 0}</p>
                      <p className="text-sm text-gray-600">En Transacciones</p>
                    </div>
                    <div className="text-center p-4">
                      <Button 
                        onClick={() => refetchAllProducts()} 
                        disabled={allProductsLoading}
                        size="sm"
                        variant="outline"
                        className="w-full"
                      >
                        <Search className="w-4 h-4 mr-1" />
                        Actualizar
                      </Button>
                    </div>
                  </div>

                  {/* Lista de productos */}
                  {allProductsData.products && allProductsData.products.length > 0 && (
                    <div>
                      <h3 className="font-semibold text-lg mb-3">Productos Encontrados ({allProductsData.products.length})</h3>
                      <div className="space-y-4 max-h-96 overflow-y-auto border rounded p-4">
                        {allProductsData.products.map((product: any, index: number) => (
                          <div key={product.id || index} className="border rounded p-4 bg-gray-50 dark:bg-gray-800">
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-2">
                                  <Badge variant="default">ID: {product.id}</Badge>
                                  {product.status && (
                                    <Badge variant={product.status === 'publish' ? 'default' : 'secondary'}>
                                      {product.status}
                                    </Badge>
                                  )}
                                </div>
                                <h4 className="font-semibold text-lg mb-1">
                                  {product.title?.rendered || product.title || product.name || `Producto ${product.id}`}
                                </h4>
                                {product.content?.rendered && (
                                  <div className="text-sm text-gray-600 mb-2 max-h-20 overflow-hidden">
                                    {product.content.rendered.replace(/<[^>]*>/g, '').substring(0, 200)}...
                                  </div>
                                )}
                              </div>
                              <div className="text-right ml-4">
                                {product.price && (
                                  <p className="text-lg font-bold text-green-600">${product.price}</p>
                                )}
                                {product.period_type && (
                                  <p className="text-sm text-gray-500">
                                    {product.period} {product.period_type}
                                  </p>
                                )}
                              </div>
                            </div>
                            
                            {/* Información adicional */}
                            <div className="mt-3 pt-3 border-t text-xs text-gray-500 space-y-1">
                              {product.date && (
                                <p><strong>Creado:</strong> {new Date(product.date).toLocaleDateString('es-ES')}</p>
                              )}
                              {product.link && (
                                <p><strong>URL:</strong> <a href={product.link} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">{product.link}</a></p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Productos en transacciones */}
                  {allProductsData.products_from_transactions && allProductsData.products_from_transactions.length > 0 && (
                    <div>
                      <h3 className="font-semibold text-lg mb-3">IDs de Productos en Transacciones</h3>
                      <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
                        {allProductsData.products_from_transactions.map((item: any, index: number) => (
                          <div key={index} className="text-center p-2 border rounded">
                            <Badge variant="outline" className="w-full mb-1">
                              ID: {item.id}
                            </Badge>
                            <p className="text-xs text-gray-500">
                              {item.found_in_transactions} usos
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Estado de APIs */}
                  <div>
                    <h3 className="font-semibold text-lg mb-3">Estado de APIs Consultadas</h3>
                    <div className="space-y-2">
                      {allProductsData.endpoints_attempted?.map((endpoint: string, index: number) => {
                        const response = allProductsData.raw_api_responses?.[endpoint];
                        return (
                          <div key={index} className="flex items-center justify-between text-sm p-2 bg-gray-50 dark:bg-gray-800 rounded">
                            <span className="font-mono text-xs">{endpoint}</span>
                            <div className="flex items-center gap-2">
                              {response?.status === 200 ? (
                                <>
                                  <CheckCircle className="w-4 h-4 text-green-500" />
                                  <Badge variant="default" size="sm">
                                    {response.count} items
                                  </Badge>
                                </>
                              ) : (
                                <>
                                  <AlertCircle className="w-4 h-4 text-red-500" />
                                  <Badge variant="destructive" size="sm">
                                    {response?.status || 'Error'}
                                  </Badge>
                                </>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Sección de búsqueda específica de membresías */}
        {showSpecificSearch && (
          <Card className="mt-6">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Búsqueda Específica de Membresías</CardTitle>
                <Button 
                  onClick={() => refetchSpecificSearch()} 
                  disabled={specificSearchLoading}
                  size="sm"
                  variant="outline"
                >
                  <Search className="w-4 h-4 mr-1" />
                  {specificSearchLoading ? "Buscando..." : "Buscar"}
                </Button>
              </div>
              <p className="text-sm text-gray-600">
                Buscando específicamente: Membresía Profesional, Membresía Empresarial, Membresía Institucional
              </p>
            </CardHeader>
            <CardContent>
              {specificSearchLoading && (
                <div className="text-center py-8">
                  <Clock className="w-8 h-8 mx-auto animate-spin mb-4" />
                  <p className="text-gray-600">Buscando membresías específicas en WordPress...</p>
                </div>
              )}

              {specificSearchError && (
                <div className="flex items-center text-red-600 bg-red-50 dark:bg-red-900/20 p-4 rounded">
                  <AlertCircle className="w-5 h-5 mr-2" />
                  <div>
                    <p className="font-medium">Error en búsqueda específica</p>
                    <p className="text-sm">{specificSearchError.message}</p>
                  </div>
                </div>
              )}

              {specificSearchData && (
                <div className="space-y-6">
                  {/* Resumen de búsqueda */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="text-center p-4 bg-green-50 dark:bg-green-900/20 rounded">
                      <p className="text-2xl font-bold text-green-600">{specificSearchData.summary?.specific_memberships_found || 0}</p>
                      <p className="text-sm text-gray-600">Membresías Encontradas</p>
                    </div>
                    <div className="text-center p-4 bg-blue-50 dark:bg-blue-900/20 rounded">
                      <p className="text-2xl font-bold text-blue-600">{specificSearchData.summary?.profesional_found || 0}</p>
                      <p className="text-sm text-gray-600">Profesional</p>
                    </div>
                    <div className="text-center p-4 bg-purple-50 dark:bg-purple-900/20 rounded">
                      <p className="text-2xl font-bold text-purple-600">{specificSearchData.summary?.empresarial_found || 0}</p>
                      <p className="text-sm text-gray-600">Empresarial</p>
                    </div>
                    <div className="text-center p-4 bg-orange-50 dark:bg-orange-900/20 rounded">
                      <p className="text-2xl font-bold text-orange-600">{specificSearchData.summary?.institucional_found || 0}</p>
                      <p className="text-sm text-gray-600">Institucional</p>
                    </div>
                  </div>

                  {/* Membresías encontradas */}
                  {specificSearchData.found_memberships && specificSearchData.found_memberships.length > 0 && (
                    <div>
                      <h3 className="font-semibold text-lg mb-3">Membresías Específicas Encontradas</h3>
                      <div className="space-y-4 max-h-96 overflow-y-auto border rounded p-4">
                        {specificSearchData.found_memberships.map((membership: any, index: number) => (
                          <div key={index} className="border rounded p-4 bg-gray-50 dark:bg-gray-800">
                            <div className="flex items-start justify-between mb-3">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-2">
                                  <Badge variant="default">ID: {membership.id}</Badge>
                                  <Badge 
                                    variant={membership.membership_type === 'Profesional' ? 'default' : 
                                             membership.membership_type === 'Empresarial' ? 'secondary' : 'outline'}
                                  >
                                    {membership.membership_type}
                                  </Badge>
                                  {membership.status && (
                                    <Badge variant={membership.status === 'publish' ? 'default' : 'secondary'}>
                                      {membership.status}
                                    </Badge>
                                  )}
                                </div>
                                <h4 className="font-semibold text-lg mb-2">{membership.title}</h4>
                                {membership.content && (
                                  <p className="text-sm text-gray-600 mb-2">{membership.content}...</p>
                                )}
                              </div>
                              <div className="text-right ml-4">
                                {membership.price && (
                                  <p className="text-lg font-bold text-green-600">${membership.price}</p>
                                )}
                                {membership.date && (
                                  <p className="text-sm text-gray-500">
                                    {new Date(membership.date).toLocaleDateString('es-ES')}
                                  </p>
                                )}
                              </div>
                            </div>
                            
                            <div className="text-xs text-gray-500 pt-2 border-t">
                              <p><strong>Encontrado en:</strong> {membership.found_in_search || membership.found_in_endpoint || 'búsqueda'}</p>
                              <p><strong>Tipo:</strong> {membership.type}</p>
                              {membership.link && (
                                <p><strong>URL:</strong> <a href={membership.link} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">{membership.link}</a></p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Estado de búsquedas realizadas */}
                  {specificSearchData.search_results && (
                    <div>
                      <h3 className="font-semibold text-lg mb-3">Estado de Búsquedas Realizadas</h3>
                      <div className="space-y-2">
                        {Object.entries(specificSearchData.search_results).map(([searchTerm, result]: [string, any]) => (
                          <div key={searchTerm} className="flex items-center justify-between text-sm p-2 bg-gray-50 dark:bg-gray-800 rounded">
                            <span className="font-medium capitalize">Búsqueda: "{searchTerm}"</span>
                            <div className="flex items-center gap-2">
                              {result.status === 200 ? (
                                <>
                                  <CheckCircle className="w-4 h-4 text-green-500" />
                                  <Badge variant="default" size="sm">
                                    {result.count || 0} resultados
                                  </Badge>
                                </>
                              ) : (
                                <>
                                  <AlertCircle className="w-4 h-4 text-red-500" />
                                  <Badge variant="destructive" size="sm">
                                    {result.status || 'Error'}
                                  </Badge>
                                </>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Mensaje si no se encontraron membresías */}
                  {specificSearchData.found_memberships && specificSearchData.found_memberships.length === 0 && (
                    <div className="text-center py-8">
                      <AlertCircle className="w-12 h-12 mx-auto mb-4 text-yellow-500" />
                      <h3 className="text-lg font-semibold mb-2">No se encontraron membresías específicas</h3>
                      <p className="text-gray-600 mb-4">
                        No se pudieron encontrar membresías con los términos "Profesional", "Empresarial" o "Institucional"
                      </p>
                      <p className="text-sm text-gray-500">
                        Esto puede indicar que las membresías tienen nombres diferentes o están en ubicaciones no consultadas.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Búsqueda por Username - NUEVA FUNCIONALIDAD */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Search className="w-5 h-5 mr-2" />
            Buscar Usuario por Username
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-4">
            <div className="flex-1">
              <Label htmlFor="usernameSearch">Username de WordPress</Label>
              <Input
                id="usernameSearch"
                type="text"
                placeholder="ej: comunicacion@anpr.org.mx, luciaenriquez_sedema, Comunicacion, IMINOX"
                value={searchUsername}
                onChange={(e) => setSearchUsername(e.target.value)}
              />
            </div>
            <div className="flex items-end">
              <Button 
                onClick={() => refetchUsernameMembership()} 
                disabled={!searchUsername || usernameMembershipLoading}
              >
                <Search className="w-4 h-4 mr-2" />
                {usernameMembershipLoading ? "Buscando..." : "Buscar"}
              </Button>
            </div>
          </div>

          {/* Resultados de búsqueda por username */}
          {usernameMembershipData && (
            <Card className="mt-4">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <User className="w-5 h-5 mr-2" />
                  Información de {usernameMembershipData.username}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div>
                    <Label>ID</Label>
                    <p className="font-mono">{usernameMembershipData.user_id}</p>
                  </div>
                  <div>
                    <Label>Nombre</Label>
                    <p>{usernameMembershipData.name}</p>
                  </div>
                  <div>
                    <Label>Email</Label>
                    <p>{usernameMembershipData.email}</p>
                  </div>
                  <div>
                    <Label>Estado de Membresía</Label>
                    <Badge variant={usernameMembershipData.has_active_membership ? "default" : "secondary"}>
                      {usernameMembershipData.member_status}
                    </Badge>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                  <div>
                    <Label>Membresías Activas</Label>
                    <p className="text-2xl font-bold text-green-600">
                      {usernameMembershipData.active_memberships?.length || 0}
                    </p>
                  </div>
                  <div>
                    <Label>Suscripciones</Label>
                    <p className="text-2xl font-bold text-blue-600">
                      {usernameMembershipData.subscription_ids?.length || 0}
                    </p>
                  </div>
                  <div>
                    <Label>Transacciones</Label>
                    <p className="text-2xl font-bold text-purple-600">
                      {usernameMembershipData.transaction_ids?.length || 0}
                    </p>
                  </div>
                </div>

                {usernameMembershipData.memberpress_meta && Object.keys(usernameMembershipData.memberpress_meta).length > 0 && (
                  <div>
                    <Label>Metadatos de MemberPress encontrados</Label>
                    <div className="mt-2">
                      <ScrollArea className="h-40">
                        <pre className="text-xs bg-gray-100 dark:bg-gray-800 p-3 rounded">
                          {JSON.stringify(usernameMembershipData.memberpress_meta, null, 2)}
                        </pre>
                      </ScrollArea>
                    </div>
                  </div>
                )}

                {/* Información completa de membresía */}
                {completeMembershipData && (
                  <div className="mt-6 border-t pt-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold">Información Completa de Membresía</h3>
                      <Button 
                        onClick={() => refetchCompleteMembership()} 
                        disabled={completeMembershipLoading}
                        size="sm"
                        variant="outline"
                      >
                        <Search className="w-4 h-4 mr-1" />
                        {completeMembershipLoading ? "Actualizando..." : "Actualizar"}
                      </Button>
                    </div>

                    {completeMembershipData.expiration_date && (
                      <Card className="mb-4 border-red-200 bg-gradient-to-r from-red-50 to-orange-50 dark:from-red-900/20 dark:to-orange-900/20">
                        <CardContent className="pt-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center">
                              <Calendar className="w-6 h-6 mr-3 text-red-600" />
                              <div>
                                <Label className="text-red-800 dark:text-red-200 font-bold text-lg">🔴 Caducidad de Membresía</Label>
                                <p className="text-sm text-red-600 dark:text-red-300">
                                  Fuente: {completeMembershipData.expiration_source}
                                </p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="text-2xl font-bold text-red-600">
                                {new Date(completeMembershipData.expiration_date).toLocaleDateString('es-ES', {
                                  year: 'numeric',
                                  month: 'long',
                                  day: 'numeric'
                                })}
                              </p>
                              <div className="flex items-center gap-2">
                                <div className={`w-3 h-3 rounded-full ${
                                  getExpirationInfo(completeMembershipData.expiration_date).color === 'red' ? 'bg-red-500 animate-pulse' :
                                  getExpirationInfo(completeMembershipData.expiration_date).color === 'orange' ? 'bg-orange-500' : 'bg-green-500'
                                }`}></div>
                                <p className={`text-sm font-medium ${
                                  getExpirationInfo(completeMembershipData.expiration_date).color === 'red' ? 'text-red-700' :
                                  getExpirationInfo(completeMembershipData.expiration_date).color === 'orange' ? 'text-orange-700' : 'text-green-700'
                                }`}>
                                  {getExpirationInfo(completeMembershipData.expiration_date).message}
                                </p>
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    )}

                    {completeMembershipData.active_memberships && completeMembershipData.active_memberships.length > 0 && (
                      <Card className="mb-4">
                        <CardHeader>
                          <CardTitle>Membresías Activas</CardTitle>
                        </CardHeader>
                        <CardContent>
                          {completeMembershipData.active_memberships.map((membership: any, index: number) => (
                            <div key={index} className="border rounded-lg p-4 mb-3 last:mb-0">
                              <div className="flex items-center justify-between mb-2">
                                <Badge variant="default">ID: {membership.membership_id}</Badge>
                                {membership.product_info && (
                                  <Badge variant="secondary">{membership.product_info.title || membership.product_info.name}</Badge>
                                )}
                              </div>
                              
                              {membership.product_info && (
                                <div className="text-sm space-y-1">
                                  {membership.product_info.price && (
                                    <p><strong>Precio:</strong> ${membership.product_info.price}</p>
                                  )}
                                  {membership.product_info.period_type && (
                                    <p><strong>Tipo de Periodo:</strong> {membership.product_info.period_type}</p>
                                  )}
                                  {membership.product_info.period && (
                                    <p><strong>Duración:</strong> {membership.product_info.period} {membership.product_info.period_type}</p>
                                  )}
                                </div>
                              )}
                            </div>
                          ))}
                        </CardContent>
                      </Card>
                    )}

                    {completeMembershipData.subscriptions && completeMembershipData.subscriptions.length > 0 && (
                      <Card className="mb-4">
                        <CardHeader>
                          <CardTitle>Suscripciones</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="grid gap-3">
                            {completeMembershipData.subscriptions.map((subscription: any, index: number) => (
                              <div key={index} className="border rounded-lg p-3">
                                <div className="flex items-center justify-between">
                                  <Badge variant="outline">Suscripción #{subscription.id || index + 1}</Badge>
                                  {subscription.status && (
                                    <Badge variant={subscription.status === 'active' ? 'default' : 'secondary'}>
                                      {subscription.status}
                                    </Badge>
                                  )}
                                </div>
                                
                                {subscription.next_billing_at && (
                                  <p className="text-sm mt-2">
                                    <strong>Próximo Cobro:</strong> {new Date(subscription.next_billing_at).toLocaleDateString('es-ES')}
                                  </p>
                                )}
                              </div>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    )}

                    {completeMembershipData.available_membership_products && completeMembershipData.available_membership_products.length > 0 && (
                      <Card className="mb-4">
                        <CardHeader>
                          <CardTitle>Productos de Membresía Disponibles</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="grid gap-2 max-h-60 overflow-y-auto">
                            {completeMembershipData.available_membership_products.map((product: any) => (
                              <div key={product.id} className="flex items-center justify-between text-sm border-b pb-2">
                                <span>{product.title || product.name || `Producto ${product.id}`}</span>
                                <div className="flex items-center gap-2">
                                  {product.price && <Badge variant="outline">${product.price}</Badge>}
                                  <Badge variant="secondary">ID: {product.id}</Badge>
                                </div>
                              </div>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    )}
                  </div>
                )}

                {completeMembershipLoading && (
                  <div className="mt-4 text-center">
                    <Clock className="w-6 h-6 mx-auto animate-spin mb-2" />
                    <p className="text-sm text-gray-600">Obteniendo información completa de membresía...</p>
                  </div>
                )}

                {completeMembershipError && (
                  <div className="mt-4 flex items-center text-sm text-red-600 bg-red-50 dark:bg-red-900/20 p-3 rounded">
                    <AlertCircle className="w-4 h-4 mr-2" />
                    Error obteniendo membresía completa: {completeMembershipError.message}
                  </div>
                )}

                {/* Información directa de la API de MemberPress */}
                {directMembershipData && (
                  <div className="mt-6 border-t pt-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold">API Directa de MemberPress</h3>
                      <Button 
                        onClick={() => refetchDirectMembership()} 
                        disabled={directMembershipLoading}
                        size="sm"
                        variant="outline"
                      >
                        <Search className="w-4 h-4 mr-1" />
                        {directMembershipLoading ? "Consultando..." : "Actualizar"}
                      </Button>
                    </div>

                    {/* Análisis de resultados */}
                    {directMembershipData.analysis && (
                      <Card className="mb-4 border-blue-200 bg-blue-50 dark:bg-blue-900/20">
                        <CardHeader>
                          <CardTitle className="text-blue-800 dark:text-blue-200">Análisis de Membresía</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                            <div className="text-center">
                              <p className="text-2xl font-bold text-blue-600">
                                {directMembershipData.analysis.has_member_record ? '✓' : '✗'}
                              </p>
                              <p className="text-sm text-gray-600">Registro de Miembro</p>
                            </div>
                            <div className="text-center">
                              <p className="text-2xl font-bold text-green-600">
                                {directMembershipData.analysis.subscription_count || 0}
                              </p>
                              <p className="text-sm text-gray-600">Suscripciones</p>
                            </div>
                            <div className="text-center">
                              <p className="text-2xl font-bold text-purple-600">
                                {directMembershipData.analysis.transaction_count || 0}
                              </p>
                              <p className="text-sm text-gray-600">Transacciones</p>
                            </div>
                          </div>

                          {/* Fechas de vencimiento mejoradas */}
                          <div className="mt-4">
                            {(directMembershipData.analysis.expiration_date || directMembershipData.analysis.meta_expiration_date || 
                              directMembershipData.member_info?.expires_at || directMembershipData.subscriptions?.[0]?.expires_at) ? (
                              <div className="p-4 bg-gradient-to-r from-orange-50 to-red-50 dark:from-orange-900/20 dark:to-red-900/20 rounded-lg border border-orange-200">
                                <div className="flex items-center mb-3">
                                  <Calendar className="w-6 h-6 mr-3 text-orange-600" />
                                  <h4 className="text-lg font-semibold text-orange-800 dark:text-orange-200">
                                    Información de Caducidad de Membresía
                                  </h4>
                                </div>
                                
                                <div className="space-y-3">
                                  {directMembershipData.member_info?.expires_at && (
                                    <div className="flex items-center justify-between p-3 bg-white dark:bg-gray-800 rounded border">
                                      <div>
                                        <p className="font-medium text-gray-900 dark:text-gray-100">Registro de Miembro</p>
                                        <p className="text-sm text-gray-600">Fecha principal de vencimiento</p>
                                      </div>
                                      <div className="text-right">
                                        <p className="text-xl font-bold text-red-600">
                                          {new Date(directMembershipData.member_info.expires_at).toLocaleDateString('es-ES')}
                                        </p>
                                        <div className="flex items-center gap-2">
                                          <div className={`w-2 h-2 rounded-full ${
                                            getExpirationInfo(directMembershipData.member_info.expires_at).color === 'red' ? 'bg-red-500 animate-pulse' :
                                            getExpirationInfo(directMembershipData.member_info.expires_at).color === 'orange' ? 'bg-orange-500' : 'bg-green-500'
                                          }`}></div>
                                          <p className="text-sm text-gray-500">
                                            {getExpirationInfo(directMembershipData.member_info.expires_at).message}
                                          </p>
                                        </div>
                                      </div>
                                    </div>
                                  )}

                                  {directMembershipData.subscriptions?.[0]?.expires_at && (
                                    <div className="flex items-center justify-between p-3 bg-white dark:bg-gray-800 rounded border">
                                      <div>
                                        <p className="font-medium text-gray-900 dark:text-gray-100">Suscripción Activa</p>
                                        <p className="text-sm text-gray-600">Vencimiento de suscripción</p>
                                      </div>
                                      <div className="text-right">
                                        <p className="text-xl font-bold text-orange-600">
                                          {new Date(directMembershipData.subscriptions[0].expires_at).toLocaleDateString('es-ES')}
                                        </p>
                                        <div className="flex items-center gap-2">
                                          <div className={`w-2 h-2 rounded-full ${
                                            getExpirationInfo(directMembershipData.subscriptions[0].expires_at).color === 'red' ? 'bg-red-500 animate-pulse' :
                                            getExpirationInfo(directMembershipData.subscriptions[0].expires_at).color === 'orange' ? 'bg-orange-500' : 'bg-green-500'
                                          }`}></div>
                                          <p className="text-sm text-gray-500">
                                            {getExpirationInfo(directMembershipData.subscriptions[0].expires_at).message}
                                          </p>
                                        </div>
                                      </div>
                                    </div>
                                  )}

                                  {directMembershipData.analysis.expiration_date && (
                                    <div className="flex items-center justify-between p-3 bg-white dark:bg-gray-800 rounded border">
                                      <div>
                                        <p className="font-medium text-gray-900 dark:text-gray-100">API MemberPress</p>
                                        <p className="text-sm text-gray-600">Fecha desde API directa</p>
                                      </div>
                                      <div className="text-right">
                                        <p className="text-xl font-bold text-blue-600">
                                          {new Date(directMembershipData.analysis.expiration_date).toLocaleDateString('es-ES')}
                                        </p>
                                        <div className="flex items-center gap-2">
                                          <div className={`w-2 h-2 rounded-full ${
                                            getExpirationInfo(directMembershipData.analysis.expiration_date).color === 'red' ? 'bg-red-500 animate-pulse' :
                                            getExpirationInfo(directMembershipData.analysis.expiration_date).color === 'orange' ? 'bg-orange-500' : 'bg-green-500'
                                          }`}></div>
                                          <p className="text-sm text-gray-500">
                                            {getExpirationInfo(directMembershipData.analysis.expiration_date).message}
                                          </p>
                                        </div>
                                      </div>
                                    </div>
                                  )}

                                  {directMembershipData.analysis.meta_expiration_date && (
                                    <div className="flex items-center justify-between p-3 bg-white dark:bg-gray-800 rounded border">
                                      <div>
                                        <p className="font-medium text-gray-900 dark:text-gray-100">Metadatos de Usuario</p>
                                        <p className="text-sm text-gray-600">
                                          Campo: {directMembershipData.analysis.meta_expiration_source}
                                        </p>
                                      </div>
                                      <div className="text-right">
                                        <p className="text-xl font-bold text-purple-600">
                                          {new Date(directMembershipData.analysis.meta_expiration_date).toLocaleDateString('es-ES')}
                                        </p>
                                        <div className="flex items-center gap-2">
                                          <div className={`w-2 h-2 rounded-full ${
                                            getExpirationInfo(directMembershipData.analysis.meta_expiration_date).color === 'red' ? 'bg-red-500 animate-pulse' :
                                            getExpirationInfo(directMembershipData.analysis.meta_expiration_date).color === 'orange' ? 'bg-orange-500' : 'bg-green-500'
                                          }`}></div>
                                          <p className="text-sm text-gray-500">
                                            {getExpirationInfo(directMembershipData.analysis.meta_expiration_date).message}
                                          </p>
                                        </div>
                                      </div>
                                    </div>
                                  )}

                                  {directMembershipData.analysis.latest_transaction_expires && (
                                    <div className="flex items-center justify-between p-3 bg-indigo-50 dark:bg-indigo-900/20 rounded border border-indigo-200">
                                      <div>
                                        <p className="font-medium text-indigo-900 dark:text-indigo-100">💳 Caducidad por Transacción</p>
                                        <p className="text-sm text-indigo-600">
                                          Trans. ID: {directMembershipData.analysis.latest_transaction_id} | 
                                          ${directMembershipData.analysis.latest_transaction_amount}
                                        </p>
                                        <p className="text-xs text-indigo-500">
                                          Fecha cuando la transacción caducará
                                        </p>
                                      </div>
                                      <div className="text-right">
                                        <p className="text-xl font-bold text-indigo-600">
                                          {new Date(directMembershipData.analysis.latest_transaction_expires).toLocaleDateString('es-ES')}
                                        </p>
                                        <div className="flex items-center gap-2">
                                          <div className={`w-2 h-2 rounded-full ${
                                            getExpirationInfo(directMembershipData.analysis.latest_transaction_expires).color === 'red' ? 'bg-red-500 animate-pulse' :
                                            getExpirationInfo(directMembershipData.analysis.latest_transaction_expires).color === 'orange' ? 'bg-orange-500' : 'bg-green-500'
                                          }`}></div>
                                          <p className="text-sm text-gray-500">
                                            {getExpirationInfo(directMembershipData.analysis.latest_transaction_expires).message}
                                          </p>
                                        </div>
                                      </div>
                                    </div>
                                  )}

                                  {directMembershipData.analysis.active_transaction_expires && 
                                   directMembershipData.analysis.active_transaction_expires !== directMembershipData.analysis.latest_transaction_expires && (
                                    <div className="flex items-center justify-between p-3 bg-teal-50 dark:bg-teal-900/20 rounded border border-teal-200">
                                      <div>
                                        <p className="font-medium text-teal-900 dark:text-teal-100">🎯 Transacción con Mayor Vigencia</p>
                                        <p className="text-sm text-teal-600">
                                          Trans. ID: {directMembershipData.analysis.active_transaction_id}
                                        </p>
                                        <p className="text-xs text-teal-500">
                                          Transacción que caduca más tarde
                                        </p>
                                      </div>
                                      <div className="text-right">
                                        <p className="text-xl font-bold text-teal-600">
                                          {new Date(directMembershipData.analysis.active_transaction_expires).toLocaleDateString('es-ES')}
                                        </p>
                                        <div className="flex items-center gap-2">
                                          <div className={`w-2 h-2 rounded-full ${
                                            getExpirationInfo(directMembershipData.analysis.active_transaction_expires).color === 'red' ? 'bg-red-500 animate-pulse' :
                                            getExpirationInfo(directMembershipData.analysis.active_transaction_expires).color === 'orange' ? 'bg-orange-500' : 'bg-green-500'
                                          }`}></div>
                                          <p className="text-sm text-gray-500">
                                            {getExpirationInfo(directMembershipData.analysis.active_transaction_expires).message}
                                          </p>
                                        </div>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </div>
                            ) : (
                              <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200">
                                <div className="flex items-center">
                                  <AlertCircle className="w-5 h-5 mr-2 text-yellow-600" />
                                  <p className="text-yellow-800 dark:text-yellow-200 font-medium">
                                    No se encontraron fechas de caducidad para este usuario
                                  </p>
                                </div>
                                <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-2">
                                  Esto puede indicar una membresía sin límite de tiempo o información no disponible en las fuentes consultadas.
                                </p>
                              </div>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    )}

                    {/* Información del miembro */}
                    {directMembershipData.member_info && (
                      <Card className="mb-4">
                        <CardHeader>
                          <CardTitle>Registro de Miembro en MemberPress</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-2 text-sm">
                            {directMembershipData.member_info.id && (
                              <p><strong>ID de Miembro:</strong> {directMembershipData.member_info.id}</p>
                            )}
                            {directMembershipData.member_info.user_id && (
                              <p><strong>ID de Usuario:</strong> {directMembershipData.member_info.user_id}</p>
                            )}
                            {directMembershipData.member_info.membership_id && (
                              <p><strong>ID de Membresía:</strong> {directMembershipData.member_info.membership_id}</p>
                            )}
                            {directMembershipData.member_info.status && (
                              <p><strong>Estado:</strong> 
                                <Badge variant={directMembershipData.member_info.status === 'active' ? 'default' : 'secondary'} className="ml-2">
                                  {directMembershipData.member_info.status}
                                </Badge>
                              </p>
                            )}
                            {directMembershipData.member_info.created_at && (
                              <p><strong>Creado:</strong> {new Date(directMembershipData.member_info.created_at).toLocaleDateString('es-ES')}</p>
                            )}
                            {directMembershipData.member_info.expires_at && (
                              <p><strong>Vence:</strong> {new Date(directMembershipData.member_info.expires_at).toLocaleDateString('es-ES')}</p>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    )}

                    {/* Suscripciones */}
                    {directMembershipData.subscriptions && directMembershipData.subscriptions.length > 0 && (
                      <Card className="mb-4">
                        <CardHeader>
                          <CardTitle>Suscripciones Activas ({directMembershipData.subscriptions.length})</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-3">
                            {directMembershipData.subscriptions.map((subscription: any, index: number) => (
                              <div key={index} className="border rounded p-3">
                                <div className="flex items-center justify-between mb-2">
                                  <Badge variant="default">ID: {subscription.id}</Badge>
                                  {subscription.status && (
                                    <Badge variant={subscription.status === 'active' ? 'default' : 'secondary'}>
                                      {subscription.status}
                                    </Badge>
                                  )}
                                </div>
                                
                                <div className="text-sm space-y-1">
                                  {subscription.membership_id && (
                                    <p><strong>Membresía ID:</strong> {subscription.membership_id}</p>
                                  )}
                                  {subscription.period && subscription.period_type && (
                                    <p><strong>Período:</strong> {subscription.period} {subscription.period_type}</p>
                                  )}
                                  {subscription.price && (
                                    <p><strong>Precio:</strong> ${subscription.price}</p>
                                  )}
                                  {subscription.next_billing_at && (
                                    <p><strong>Próximo Cobro:</strong> {new Date(subscription.next_billing_at).toLocaleDateString('es-ES')}</p>
                                  )}
                                  {subscription.expires_at && (
                                    <p><strong>Expira:</strong> {new Date(subscription.expires_at).toLocaleDateString('es-ES')}</p>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    )}

                    {/* Análisis de Transacciones Detallado */}
                    {directMembershipData.analysis?.transaction_analysis && directMembershipData.analysis.transaction_analysis.length > 0 && (
                      <Card className="mb-4">
                        <CardHeader>
                          <CardTitle className="flex items-center gap-2">
                            <CheckCircle className="w-5 h-5 text-green-600" />
                            Análisis Detallado de Transacciones ({directMembershipData.analysis.transaction_analysis.length})
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-4 max-h-80 overflow-y-auto">
                            {directMembershipData.analysis.transaction_analysis.map((transaction: any, index: number) => (
                              <div key={index} className={`border rounded-lg p-4 ${
                                transaction.status === 'complete' ? 'bg-green-50 border-green-200' : 
                                transaction.status === 'confirmed' ? 'bg-blue-50 border-blue-200' : 
                                'bg-gray-50 border-gray-200'
                              }`}>
                                <div className="flex items-center justify-between mb-3">
                                  <div className="flex items-center gap-2">
                                    <Badge variant="outline" className="font-mono">#{transaction.id}</Badge>
                                    <Badge variant={
                                      transaction.status === 'complete' ? 'default' : 
                                      transaction.status === 'confirmed' ? 'default' : 'secondary'
                                    }>
                                      {transaction.status}
                                    </Badge>
                                  </div>
                                  {transaction.amount && (
                                    <p className="text-lg font-bold text-green-600">${transaction.amount}</p>
                                  )}
                                </div>
                                
                                <div className="grid grid-cols-2 gap-4 text-sm">
                                  <div>
                                    {transaction.product_title && (
                                      <p><strong>Producto:</strong> {transaction.product_title}</p>
                                    )}
                                    {transaction.membership_id && (
                                      <p><strong>Membresía ID:</strong> {transaction.membership_id}</p>
                                    )}
                                    {transaction.created_at && (
                                      <p><strong>Fecha:</strong> {new Date(transaction.created_at).toLocaleDateString('es-ES')}</p>
                                    )}
                                    {transaction.gateway && (
                                      <p><strong>Método de Pago:</strong> {transaction.gateway}</p>
                                    )}
                                  </div>
                                  <div>
                                    {transaction.expires_at && (
                                      <div>
                                        <div className="flex items-center gap-2 mb-1">
                                          <strong>Transacción Caduca:</strong>
                                          <div className={`w-2 h-2 rounded-full ${
                                            getExpirationInfo(transaction.expires_at).color === 'red' ? 'bg-red-500 animate-pulse' :
                                            getExpirationInfo(transaction.expires_at).color === 'orange' ? 'bg-orange-500' : 'bg-green-500'
                                          }`}></div>
                                          <span className={`${
                                            getExpirationInfo(transaction.expires_at).color === 'red' ? 'text-red-700' :
                                            getExpirationInfo(transaction.expires_at).color === 'orange' ? 'text-orange-700' : 'text-green-700'
                                          }`}>
                                            {new Date(transaction.expires_at).toLocaleDateString('es-ES')}
                                          </span>
                                        </div>
                                        <p className="text-xs text-gray-500">
                                          {getExpirationInfo(transaction.expires_at).message}
                                        </p>
                                      </div>
                                    )}
                                    {transaction.subscription_id && (
                                      <p><strong>Suscripción ID:</strong> {transaction.subscription_id}</p>
                                    )}
                                    {transaction.product_id && (
                                      <p><strong>Producto ID:</strong> {transaction.product_id}</p>
                                    )}
                                  </div>
                                </div>

                                {transaction.product_content && (
                                  <div className="mt-3 p-2 bg-white rounded border">
                                    <p className="text-xs text-gray-600">
                                      <strong>Descripción:</strong> {transaction.product_content.substring(0, 150)}...
                                    </p>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    )}

                    {/* Transacciones Básicas - Solo mostrar si no hay análisis detallado */}
                    {(!directMembershipData.analysis?.transaction_analysis || directMembershipData.analysis.transaction_analysis.length === 0) && 
                     directMembershipData.transactions && directMembershipData.transactions.length > 0 && (
                      <Card className="mb-4">
                        <CardHeader>
                          <CardTitle>Historial de Transacciones ({directMembershipData.transactions.length})</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-3 max-h-60 overflow-y-auto">
                            {directMembershipData.transactions.map((transaction: any, index: number) => (
                              <div key={index} className="border rounded p-3 text-sm">
                                <div className="flex items-center justify-between mb-2">
                                  <Badge variant="outline">Trans. #{transaction.id}</Badge>
                                  {transaction.status && (
                                    <Badge variant={transaction.status === 'complete' ? 'default' : 'secondary'}>
                                      {transaction.status}
                                    </Badge>
                                  )}
                                </div>
                                
                                <div className="space-y-1">
                                  {transaction.membership_id && (
                                    <p><strong>Membresía:</strong> {transaction.membership_id}</p>
                                  )}
                                  {transaction.amount && (
                                    <p><strong>Monto:</strong> ${transaction.amount}</p>
                                  )}
                                  {transaction.created_at && (
                                    <p><strong>Fecha:</strong> {new Date(transaction.created_at).toLocaleDateString('es-ES')}</p>
                                  )}
                                  {transaction.gateway && (
                                    <p><strong>Método:</strong> {transaction.gateway}</p>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    )}

                    {/* Estado de APIs consultadas */}
                    <Card>
                      <CardHeader>
                        <CardTitle>Estado de Endpoints de MemberPress</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          {directMembershipData.raw_responses && Object.entries(directMembershipData.raw_responses).map(([endpoint, response]: [string, any]) => (
                            <div key={endpoint} className="flex items-center justify-between text-sm p-2 bg-gray-50 dark:bg-gray-800 rounded">
                              <span className="font-mono text-xs">{endpoint}</span>
                              <div className="flex items-center gap-2">
                                {response.status === 200 ? (
                                  <>
                                    <CheckCircle className="w-4 h-4 text-green-500" />
                                    <Badge variant="default" size="sm">
                                      {response.count || 1} items
                                    </Badge>
                                  </>
                                ) : (
                                  <>
                                    <AlertCircle className="w-4 h-4 text-red-500" />
                                    <Badge variant="destructive" size="sm">
                                      {response.status || 'Error'}
                                    </Badge>
                                  </>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                )}

                {directMembershipLoading && (
                  <div className="mt-4 text-center">
                    <Clock className="w-6 h-6 mx-auto animate-spin mb-2" />
                    <p className="text-sm text-gray-600">Consultando API directa de MemberPress...</p>
                  </div>
                )}

                {directMembershipError && (
                  <div className="mt-4 flex items-center text-sm text-red-600 bg-red-50 dark:bg-red-900/20 p-3 rounded">
                    <AlertCircle className="w-4 h-4 mr-2" />
                    Error en API directa: {directMembershipError.message}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {usernameMembershipError && (
            <div className="flex items-center text-sm text-red-600 bg-red-50 dark:bg-red-900/20 p-3 rounded">
              <AlertCircle className="w-4 h-4 mr-2" />
              Error: {usernameMembershipError.message}
            </div>
          )}
        </CardContent>
      </Card>

      <Separator />

      {/* Selector de Usuario */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <User className="w-5 h-5 mr-2" />
            Seleccionar Usuario de WordPress
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="userSelect">Seleccionar de la lista</Label>
              <select
                id="userSelect"
                className="w-full p-2 border rounded-md"
                value={selectedUserId}
                onChange={(e) => setSelectedUserId(e.target.value)}
                disabled={wpUsersLoading}
              >
                <option value="">-- Seleccionar usuario --</option>
                {wpUsers?.users?.map((user: any) => (
                  <option key={user.id} value={user.id}>
                    {user.name} ({user.email}) - ID: {user.id}
                  </option>
                ))}
              </select>
            </div>
            
            <div>
              <Label htmlFor="userIdInput">O escribir ID directamente</Label>
              <Input
                id="userIdInput"
                type="number"
                placeholder="ID del usuario"
                value={selectedUserId}
                onChange={(e) => setSelectedUserId(e.target.value)}
              />
            </div>
          </div>
          
          <Button 
            onClick={handleTestUser} 
            disabled={!selectedUserId || membershipLoading}
            className="w-full"
          >
            <Search className="w-4 h-4 mr-2" />
            {membershipLoading ? "Probando..." : "Probar Membresía"}
          </Button>
        </CardContent>
      </Card>

      {/* Resultados */}
      {testUserId && (
        <div className="space-y-6">
          {/* Información Básica del Usuario */}
          {membershipData?.user_basic_info && (
            <Card>
              <CardHeader>
                <CardTitle>Información Básica del Usuario</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label>ID</Label>
                    <p className="font-mono">{membershipData.user_basic_info.id}</p>
                  </div>
                  <div>
                    <Label>Nombre</Label>
                    <p>{membershipData.user_basic_info.name}</p>
                  </div>
                  <div>
                    <Label>Email</Label>
                    <p>{membershipData.user_basic_info.email}</p>
                  </div>
                  <div>
                    <Label>Username</Label>
                    <p>{membershipData.user_basic_info.username}</p>
                  </div>
                </div>
                
                <Separator className="my-4" />
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label>Roles</Label>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {membershipData.user_basic_info.roles?.map((role: string) => (
                        <Badge key={role} variant="outline">{role}</Badge>
                      ))}
                    </div>
                  </div>
                  <div>
                    <Label>Capabilities</Label>
                    <p className="text-sm text-gray-500">
                      {Object.keys(membershipData.user_basic_info.capabilities || {}).length} permisos
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Análisis de Membresía */}
          {membershipData?.membership_analysis && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Shield className="w-5 h-5 mr-2" />
                  Análisis de Membresía
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <h4 className="font-medium mb-2">Análisis de Roles</h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                      <div className={`p-2 rounded ${membershipData.membership_analysis.roles_analysis.has_member_role ? 'bg-green-100' : 'bg-gray-100'}`}>
                        <span className="text-sm">Rol de Miembro: </span>
                        <Badge variant={membershipData.membership_analysis.roles_analysis.has_member_role ? "default" : "outline"}>
                          {membershipData.membership_analysis.roles_analysis.has_member_role ? "Sí" : "No"}
                        </Badge>
                      </div>
                      <div className={`p-2 rounded ${membershipData.membership_analysis.roles_analysis.has_subscriber_role ? 'bg-blue-100' : 'bg-gray-100'}`}>
                        <span className="text-sm">Suscriptor: </span>
                        <Badge variant={membershipData.membership_analysis.roles_analysis.has_subscriber_role ? "default" : "outline"}>
                          {membershipData.membership_analysis.roles_analysis.has_subscriber_role ? "Sí" : "No"}
                        </Badge>
                      </div>
                      <div className="p-2 rounded bg-gray-100">
                        <span className="text-sm">Roles Personalizados: </span>
                        <span className="font-mono text-xs">
                          {membershipData.membership_analysis.roles_analysis.custom_roles?.length || 0}
                        </span>
                      </div>
                    </div>
                  </div>

                  {Object.keys(membershipData.membership_analysis.potential_membership_meta || {}).length > 0 && (
                    <div>
                      <h4 className="font-medium mb-2">Campos Meta Relacionados con Membresía</h4>
                      <ScrollArea className="h-32 border rounded p-2">
                        <pre className="text-xs">
                          {JSON.stringify(membershipData.membership_analysis.potential_membership_meta, null, 2)}
                        </pre>
                      </ScrollArea>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Respuestas de Plugins */}
          {membershipData?.plugin_responses && (
            <Card>
              <CardHeader>
                <CardTitle>Respuestas de Plugins de Membresía</CardTitle>
                <p className="text-sm text-gray-600">
                  Probando diferentes plugins comunes de membresías en WordPress
                </p>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {Object.entries(membershipData.plugin_responses).map(([key, pluginData]) => 
                    renderPluginResponse(pluginData, key)
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Recomendaciones */}
          {membershipData?.recommendations && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <AlertCircle className="w-5 h-5 mr-2" />
                  Recomendaciones
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-700 mb-4">
                  {membershipData.recommendations.note}
                </p>
                <div className="space-y-2">
                  <h4 className="font-medium">Plugins Comunes de Membresía:</h4>
                  <ul className="text-sm space-y-1">
                    {membershipData.recommendations.common_plugins?.map((plugin: string, index: number) => (
                      <li key={index} className="flex items-start">
                        <span className="w-2 h-2 bg-blue-500 rounded-full mt-2 mr-2 flex-shrink-0"></span>
                        {plugin}
                      </li>
                    ))}
                  </ul>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Error */}
          {membershipError && (
            <Card className="border-red-200">
              <CardHeader>
                <CardTitle className="text-red-600 flex items-center">
                  <AlertCircle className="w-5 h-5 mr-2" />
                  Error
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-red-600">{membershipError.message}</p>
                <Button 
                  onClick={() => refetchMembership()} 
                  variant="outline" 
                  className="mt-2"
                >
                  Reintentar
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}