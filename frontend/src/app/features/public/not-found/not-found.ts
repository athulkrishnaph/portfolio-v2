import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

/** Shown for unknown URLs. */
@Component({
  selector: 'app-not-found',
  imports: [RouterLink],
  template: `
    <section class="container section not-found">
      <span class="eyebrow">// 404</span>
      <h1>Page not found</h1>
      <p class="text-muted">The page you're looking for doesn't exist or has been moved.</p>
      <a class="btn btn--primary" routerLink="/">Back to home</a>
    </section>
  `,
  styles: `
    .not-found {
      text-align: center;
    }
  `,
})
export class NotFound {}
