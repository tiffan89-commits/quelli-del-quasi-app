// Explicit submit supports desktop Enter and mobile keyboard action keys.
document.addEventListener('keydown',event=>{
 if(event.key!=='Enter'||event.isComposing||event.repeat||event.ctrlKey||event.altKey||event.metaKey||!event.target.matches?.('input'))return;
 const form=event.target.closest('form');
 if(!form||!['auth','admin-login-form','admin-code-form','form'].includes(form.id))return;
 const submit=form.querySelector('button[type="submit"],button:not([type]),input[type="submit"]');
 event.preventDefault();
 if(form.dataset.submitting==='true'||submit?.disabled)return;
 form.requestSubmit(submit||undefined);
},true);
