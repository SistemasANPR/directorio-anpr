#!/usr/bin/env python3

import requests
import json
import base64

# Configuración de WordPress
wp_url = "https://anpr.org.mx"
# Usamos credenciales básicas para probar
auth = base64.b64encode(b'admin:admin').decode('ascii')

headers = {
    'Authorization': f'Basic {auth}',
    'Content-Type': 'application/json'
}

def test_endpoint(endpoint):
    """Prueba un endpoint y retorna los datos"""
    try:
        url = f"{wp_url}{endpoint}"
        print(f"\n🔍 Probando: {url}")
        
        response = requests.get(url, headers=headers, timeout=10)
        print(f"Status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"Datos encontrados: {len(data) if isinstance(data, list) else 1} items")
            
            # Mostrar algunos ejemplos
            if isinstance(data, list) and len(data) > 0:
                for i, item in enumerate(data[:3]):  # Mostrar primeros 3
                    print(f"  {i+1}. ID: {item.get('id', 'N/A')}")
                    
                    # Buscar el nombre/título
                    title = None
                    if 'title' in item:
                        if isinstance(item['title'], dict):
                            title = item['title'].get('rendered', '')
                        else:
                            title = item['title']
                    elif 'name' in item:
                        title = item['name']
                    elif 'post_title' in item:
                        title = item['post_title']
                    
                    print(f"     Nombre: {title or 'Sin nombre'}")
                    
                    # Buscar precio
                    price = item.get('price', item.get('meta', {}).get('_price', ''))
                    if price:
                        print(f"     Precio: {price}")
                    
            return data
        else:
            print(f"Error: {response.text[:200]}")
            return None
            
    except Exception as e:
        print(f"Excepción: {e}")
        return None

def main():
    print("=== INVESTIGACIÓN DE MEMBRESÍAS MEMBERPRESS ===\n")
    
    # Lista de endpoints para probar
    endpoints = [
        "/wp-json/mp/v1/memberships",
        "/wp-json/mp/v1/products",
        "/wp-json/memberpress/v1/memberships",
        "/wp-json/wp/v2/mp_membership",
        "/wp-json/wp/v2/posts?post_type=memberpressproduct",
        "/wp-json/wp/v2/posts?post_type=product",
        "/wp-json/wp/v2/posts?search=membresía",
        "/wp-json/wp/v2/posts?search=profesional",
        "/wp-json/wp/v2/posts?search=empresarial",
        "/wp-json/wp/v2/posts?search=institucional",
    ]
    
    all_results = {}
    
    for endpoint in endpoints:
        result = test_endpoint(endpoint)
        if result:
            all_results[endpoint] = result
    
    # Buscar nombres específicos
    print("\n\n=== BÚSQUEDA DE MEMBRESÍAS ESPECÍFICAS ===")
    search_terms = ["profesional", "empresarial", "institucional"]
    
    for endpoint, data in all_results.items():
        if isinstance(data, list):
            for item in data:
                # Buscar en título
                title = ""
                if 'title' in item:
                    if isinstance(item['title'], dict):
                        title = item['title'].get('rendered', '').lower()
                    else:
                        title = str(item['title']).lower()
                elif 'name' in item:
                    title = str(item['name']).lower()
                
                # Buscar en contenido
                content = ""
                if 'content' in item:
                    if isinstance(item['content'], dict):
                        content = item['content'].get('rendered', '').lower()
                    else:
                        content = str(item['content']).lower()
                
                # Buscar términos específicos
                for term in search_terms:
                    if term in title or term in content:
                        print(f"\n✅ ENCONTRADO '{term.upper()}' en {endpoint}")
                        print(f"   ID: {item.get('id')}")
                        print(f"   Título: {title}")
                        if item.get('price'):
                            print(f"   Precio: {item.get('price')}")

if __name__ == "__main__":
    main()