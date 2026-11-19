export function bindSiteValidation(root=document){
 function clear(event){
  const form=event.target.form;
  form?.querySelector('[data-site-field-error]')?.remove();
 }
 root.addEventListener('invalid',event=>{
  const field=event.target,form=field.form;
  if(!form)return;
  event.preventDefault();
  if(form.querySelector('[data-site-field-error]'))return;
  const error=root.createElement('p');
  error.className='notice site-field-error';error.dataset.siteFieldError='';error.setAttribute('role','alert');
  error.textContent=field.validationMessage||'Controlla il campo evidenziato.';
  const proxy=field.closest('.quasi-select')?.querySelector('button')||field;
  proxy.insertAdjacentElement('afterend',error);
  proxy.focus({preventScroll:true});
 },true);
 root.addEventListener('input',clear);
 root.addEventListener('change',clear);
}
