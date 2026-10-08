import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IntroDirective } from '../../../shared/directives/intro.directive';

/** Shown for unknown URLs. */
@Component({
  selector: 'app-not-found',
  imports: [RouterLink, IntroDirective],
  templateUrl: './not-found.html',
  styleUrl: './not-found.scss',
})
export class NotFound {}
