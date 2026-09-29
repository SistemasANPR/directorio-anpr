// Helper functions for plan comparison
const isPlanUpgrade = (currentPlan, targetPlan) => {
  const currentPrice = currentPlan?.precioMensual || 0;
  const targetPrice = targetPlan?.precioMensual || 0;
  return targetPrice > currentPrice;
};

const isPlanDowngrade = (currentPlan, targetPlan) => {
  const currentPrice = currentPlan?.precioMensual || 0;
  const targetPrice = targetPlan?.precioMensual || 0;
  return targetPrice < currentPrice;
};

const getUpgradeMotivation = (targetPlan) => {
  const benefits = [
    "🚀 Acceso a funciones Premium exclusivas",
    "📈 Mayor visibilidad en el directorio",
    "🎯 Herramientas avanzadas de marketing",
    "⭐ Soporte prioritario 24/7",
    "💼 Más proyectos y productos permitidos"
  ];
  return benefits;
};

const getDowngradeLimitations = (currentPlan, targetPlan) => {
  const limitations = [];
  
  if (currentPlan?.cantidadProductosAdmitidos > targetPlan?.cantidadProductosAdmitidos) {
    limitations.push(`🔴 Productos: Máximo ${targetPlan?.cantidadProductosAdmitidos || 0} (actualmente tienes ${currentPlan?.cantidadProductosAdmitidos || 0})`);
  }
  
  if (currentPlan?.cantidadProyectosAdmitidos > targetPlan?.cantidadProyectosAdmitidos) {
    limitations.push(`🔴 Proyectos: Máximo ${targetPlan?.cantidadProyectosAdmitidos || 0} (actualmente tienes ${currentPlan?.cantidadProyectosAdmitidos || 0})`);
  }
  
  if (currentPlan?.cantidadFotosPorProyecto > targetPlan?.cantidadFotosPorProyecto) {
    limitations.push(`🔴 Fotos por proyecto: Máximo ${targetPlan?.cantidadFotosPorProyecto || 5} (actualmente ${currentPlan?.cantidadFotosPorProyecto || 5})`);
  }
  
  return limitations;
};

const handlePlanSelection = (plan, setSelectedNewPlan, setShowPlanConfirmation) => {
  setSelectedNewPlan(plan);
  setShowPlanConfirmation(true);
};

const handleConfirmPlanChange = (selectedNewPlan, selectedPeriodicidad, changePlanMutation) => {
  if (selectedNewPlan) {
    changePlanMutation.mutate({
      targetPlanId: selectedNewPlan.id,
      periodicidad: selectedPeriodicidad
    });
  }
};

const getPlanPrice = (plan, periodicidad) => {
  const opcionesPrecios = Array.isArray(plan.opcionesPrecios) ? plan.opcionesPrecios : [];
  const precioOption = opcionesPrecios.find((op) => 
    op.periodicidad?.toLowerCase() === periodicidad.toLowerCase()
  );
  return precioOption ? precioOption.costo : plan.precioMensual;
};