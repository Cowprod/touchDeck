// Server-side visual token resolution. Devices receive final values only.
export const COLORS = Object.freeze({
  primary:'#0d6efd', secondary:'#6c757d', success:'#198754',
  warning:'#ffc107', danger:'#dc3545', info:'#0dcaf0',
  light:'#f8f9fa', dark:'#212529'
});
export const FONT_SIZES = Object.freeze({small:12, normal:15, large:20});
export function resolvePage(page, profile) {
  if (!page || !profile) return null;
  return {
    id:page.id,title:page.title,visible:page.visible,
    backgroundColor:COLORS[page.background] ?? '#0f172a',
    components:page.components.map(item=>({
      id:item.id,type:item.type,text:item.text??'',
      x:Math.round(item.x*profile.width/profile.gridColumns),
      y:Math.round(item.y*profile.height/profile.gridRows),
      w:Math.round(item.w*profile.width/profile.gridColumns),
      h:Math.round(item.h*profile.height/profile.gridRows),
      backgroundColor:COLORS[item.background] ?? '#334155',
      textColor:COLORS[item.color] ?? '#f9fafb',
      fontSize:FONT_SIZES[item.fontSize] ?? FONT_SIZES.normal,
      radius:item.radius===0||item.radius===1||item.radius===2?item.radius:1,
      active:item.active===true,
      disabled:item.disabled===true
    }))
  };
}
