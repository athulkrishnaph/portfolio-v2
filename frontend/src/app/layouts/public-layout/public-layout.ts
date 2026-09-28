import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { Navbar } from '../navbar/navbar';
import { Footer } from '../footer/footer';

/** Shell for every public page: navbar, page content, footer. */
@Component({
  selector: 'app-public-layout',
  imports: [RouterOutlet, Navbar, Footer],
  template: `
    <a class="skip-link" href="#main-content">Skip to content</a>
    <app-navbar />
    <main id="main-content" class="public-main" tabindex="-1">
      <router-outlet />
    </main>
    <app-footer />
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      min-height: 100vh;
    }
    .public-main {
      flex: 1;
      outline: none;
    }
  `,
})
export class PublicLayout {}
