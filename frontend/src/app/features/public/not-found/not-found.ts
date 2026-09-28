import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

/** Shown for unknown URLs. */
@Component({
  selector: 'app-not-found',
  imports: [RouterLink],
  templateUrl: './not-found.html',
  styleUrl: './not-found.scss',
})
export class NotFound {}
