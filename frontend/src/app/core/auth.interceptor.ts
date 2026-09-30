import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';

import { AuthService } from './auth.service';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  // Toute requête à l'API vaut signe de vie : la session ne se referme que
  // sur une vraie inactivité, jamais au milieu d'une soirée de saisie.
  auth.touch();
  const token = auth.token();
  const authReq = token
    ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
    : req;

  return next(authReq).pipe(
    catchError((err) => {
      if (err.status === 401 && token) {
        // Token expiré ou invalidé côté serveur — on déconnecte.
        auth.logout();
        router.navigate(['/login']);
      }
      return throwError(() => err);
    })
  );
};
