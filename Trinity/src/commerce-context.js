// Caller supplies this only from authenticated server state, never from chat text.
export const COMMERCE_TOOLS=new Set(['sales_lead_save','sales_offer_create','sales_pipeline']);
export function commercePrincipal(context){
 if(context?.ownerAuthorized!==true||typeof context.ownerId!=='string')return null;
 const ownerId=context.ownerId.trim().toLowerCase();
 if(!ownerId||ownerId.length>200)return null;
 return {ownerAuthorized:true,ownerId};
}
export function requireCommercePrincipal(context){
 const principal=commercePrincipal(context);
 if(!principal)throw new Error('Obchodné záznamy vyžadujú serverom overeného vlastníka.');
 return principal;
}
