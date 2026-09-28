import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { ChatWidget } from '../../features/public/chat/chat-widget';
import { Navbar } from '../navbar/navbar';
import { Footer } from '../footer/footer';

/** Shell for every public page: navbar, page content, footer, chat assistant. */
@Component({
  selector: 'app-public-layout',
  imports: [RouterOutlet, Navbar, Footer, ChatWidget],
  templateUrl: './public-layout.html',
  styleUrl: './public-layout.scss',
})
export class PublicLayout {}
